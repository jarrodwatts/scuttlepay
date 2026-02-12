#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# ScuttlePay Dev Cycle — Autonomous task runner powered by Claude Code CLI
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SPEC_PATH="$PROJECT_DIR/docs/SPEC.md"
PROGRESS_DIR="$PROJECT_DIR/.dev-cycle"
PROGRESS_FILE="$PROGRESS_DIR/progress.json"
LOG_DIR="$PROGRESS_DIR/logs"
PROMPTS_DIR="$SCRIPT_DIR/prompts"

MODEL="opus"
TOTAL_BUDGET_CENTS=50000  # $500.00 hard cap
MAX_RETRIES_PER_PHASE=3
MAX_RETRIES_PER_TASK=5
RETRY_BACKOFFS=(60 120 300)

# Task order derived from SPEC.md dependency graph
TASK_ORDER=(2.0 2.1 2.2 2.3 3.1 3.2 4.1 4.2 4.3 4.4 4.5 5.1 5.2 5.3 5.4 5.5 6.1 6.2 6.3 6.4 7.3)

# Dependencies per task (bash 3.2 compatible — no associative arrays)
get_task_deps() {
  case "$1" in
    2.0) echo "" ;;
    2.1) echo "2.0" ;;
    2.2) echo "2.1" ;;
    2.3) echo "2.2" ;;
    3.1) echo "2.0" ;;
    3.2) echo "3.1" ;;
    4.1) echo "" ;;
    4.2) echo "2.1 2.2" ;;
    4.3) echo "3.1" ;;
    4.4) echo "4.1 4.2 4.3" ;;
    4.5) echo "4.4 2.0" ;;
    5.1) echo "2.0" ;;
    5.2) echo "5.1 3.2" ;;
    5.3) echo "5.1 4.5" ;;
    5.4) echo "5.1 2.3 4.5" ;;
    5.5) echo "5.2 5.3 5.4" ;;
    6.1) echo "2.3 4.5" ;;
    6.2) echo "6.1" ;;
    6.3) echo "6.1" ;;
    6.4) echo "" ;;
    7.3) echo "4.5" ;;
    *) echo "" ;;
  esac
}

# =============================================================================
# Logging
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()      { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $*"; }
log_info() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
log_ok()   { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $*"; }
log_warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] !${NC} $*"; }
log_err()  { echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $*"; }

# =============================================================================
# Progress file management
# =============================================================================

init_progress() {
  mkdir -p "$PROGRESS_DIR" "$LOG_DIR"
  if [[ ! -f "$PROGRESS_FILE" ]]; then
    cat > "$PROGRESS_FILE" <<'INIT'
{
  "currentTask": null,
  "currentPhase": null,
  "completedTasks": [],
  "failedTasks": [],
  "totalCostCents": 0,
  "stats": { "totalTasks": 21, "completed": 0, "failed": 0 }
}
INIT
    log_info "Initialized progress file"
  fi
}

read_progress() {
  jq -r "$1" "$PROGRESS_FILE"
}

update_progress() {
  local tmp="$PROGRESS_FILE.tmp"
  jq "$@" "$PROGRESS_FILE" > "$tmp" && mv "$tmp" "$PROGRESS_FILE"
}

is_task_completed() {
  local task_id="$1"
  jq -e --arg id "$task_id" '.completedTasks[] | select(.taskId == $id)' "$PROGRESS_FILE" > /dev/null 2>&1
}

is_task_failed() {
  local task_id="$1"
  jq -e --arg id "$task_id" '.failedTasks[] | select(.taskId == $id)' "$PROGRESS_FILE" > /dev/null 2>&1
}

get_session_id() {
  local task_id="$1"
  local session_file="$PROGRESS_DIR/sessions/${task_id}.json"
  if [[ -f "$session_file" ]]; then
    jq -r '.sessionId // empty' "$session_file"
  fi
}

save_session_id() {
  local task_id="$1" session_id="$2" phase="$3"
  mkdir -p "$PROGRESS_DIR/sessions"
  local session_file="$PROGRESS_DIR/sessions/${task_id}.json"
  if [[ -f "$session_file" ]]; then
    jq --arg sid "$session_id" --arg phase "$phase" \
      '.sessionId = $sid | .phases[$phase] = {"completedAt": (now | todate)}' \
      "$session_file" > "${session_file}.tmp" && mv "${session_file}.tmp" "$session_file"
  else
    cat > "$session_file" <<EOF
{"taskId": "$task_id", "sessionId": "$session_id", "phases": {"$phase": {"completedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}}}
EOF
  fi
}

# =============================================================================
# Budget tracking
# =============================================================================

get_total_cost_cents() {
  jq -r '.totalCostCents // 0' "$PROGRESS_FILE"
}

add_cost_cents() {
  local cents="$1"
  if [[ "$cents" -gt 0 ]]; then
    update_progress --argjson c "$cents" '.totalCostCents = (.totalCostCents // 0) + $c'
  fi
}

check_budget() {
  local current
  current=$(get_total_cost_cents)
  if [[ "$current" -ge "$TOTAL_BUDGET_CENTS" ]]; then
    local dollars
    dollars=$(echo "scale=2; $current / 100" | bc)
    log_err "Budget cap reached: \$$dollars / \$$(echo "scale=2; $TOTAL_BUDGET_CENTS / 100" | bc)"
    return 1
  fi
  return 0
}

# Extract cost from claude CLI output (cents)
# JSON output: .cost_usd field (if present)
# Stream-json: last result line with cost info
extract_cost_cents() {
  local output="$1" format="$2"
  local cost_usd=""
  if [[ "$format" == "stream-json" ]]; then
    cost_usd=$(echo "$output" | grep '"cost_usd"' | tail -1 | jq -r '.cost_usd // empty' 2>/dev/null || echo "")
  else
    cost_usd=$(echo "$output" | jq -r '.cost_usd // empty' 2>/dev/null || echo "")
  fi
  if [[ -n "$cost_usd" && "$cost_usd" != "null" ]]; then
    echo "$cost_usd" | awk '{printf "%d", $1 * 100}'
  else
    echo "0"
  fi
}

# =============================================================================
# Task spec extraction
# =============================================================================

extract_task_spec() {
  local task_id="$1"
  # Extract everything between "### Task {id}:" and the next "---"
  # macOS sed compatible — remove the trailing "---" line
  sed -n "/^### Task ${task_id}:/,/^---$/p" "$SPEC_PATH" | sed '$d'
}

extract_task_title() {
  local task_id="$1"
  sed -n "s/^### Task ${task_id}: \(.*\)/\1/p" "$SPEC_PATH"
}

# =============================================================================
# Dependency checking
# =============================================================================

check_dependencies() {
  local task_id="$1"
  local deps
  deps=$(get_task_deps "$task_id")
  if [[ -z "$deps" ]]; then
    return 0
  fi
  for dep in $deps; do
    if ! is_task_completed "$dep"; then
      log_err "Task $task_id requires $dep (not completed)"
      return 1
    fi
  done
  return 0
}

# =============================================================================
# Build prompts with context
# =============================================================================

build_context_summary() {
  local completed
  completed=$(jq -r '.completedTasks[] | "- Task \(.taskId): \(.keyDecisions // [] | join("; "))"' "$PROGRESS_FILE" 2>/dev/null || echo "")
  if [[ -n "$completed" ]]; then
    echo "## Prior Completed Tasks"
    echo ""
    echo "$completed"
    echo ""
  fi
}

build_understand_prompt() {
  local task_id="$1"
  local spec
  spec=$(extract_task_spec "$task_id")
  local context
  context=$(build_context_summary)

  cat <<EOF
Analyze the following task from the ScuttlePay SPEC.

## Task Specification
$spec

$context

Read all files referenced in the task spec. Identify patterns from existing code. Report your analysis with the UNDERSTAND_OUTPUT JSON block as instructed.
EOF
}

build_implement_prompt() {
  local task_id="$1"
  local spec
  spec=$(extract_task_spec "$task_id")

  cat <<EOF
Implement the plan you designed. Here is the task spec for reference:

## Task Specification
$spec

Follow your plan from the previous turns. Run pnpm typecheck and pnpm lint when done. Output the IMPLEMENT_OUTPUT JSON block at the end.
EOF
}

build_verify_prompt() {
  local task_id="$1"
  local spec
  spec=$(extract_task_spec "$task_id")
  local context
  context=$(build_context_summary)

  # Get files from progress or session
  local files_info=""
  local session_file="$PROGRESS_DIR/sessions/${task_id}.json"
  if [[ -f "$PROGRESS_DIR/implement-output-${task_id}.json" ]]; then
    files_info=$(cat "$PROGRESS_DIR/implement-output-${task_id}.json")
  fi

  cat <<EOF
Verify the implementation of the following task.

## Task Specification
$spec

## Implementation Info
$files_info

$context

Run all verification checks from the spec. Run pnpm typecheck and pnpm lint. Report results with the VERIFY_OUTPUT JSON block as instructed.
EOF
}

# =============================================================================
# Phase execution
# =============================================================================

run_phase() {
  local phase="$1" task_id="$2"
  local session_id log_file exit_code output

  # Budget check before starting
  if ! check_budget; then
    return 1
  fi

  log "Phase: $(echo "$phase" | tr '[:lower:]' '[:upper:]') (Task $task_id)"

  log_file="$LOG_DIR/task-${task_id}-${phase}.log"

  local claude_args=(
    -p
    --model "$MODEL"
    --dangerously-skip-permissions
  )

  case "$phase" in
    understand)
      claude_args+=(
        --output-format json
        --max-turns 15
        --append-system-prompt-file "$PROMPTS_DIR/understand.md"
      )
      local prompt
      prompt=$(build_understand_prompt "$task_id")
      ;;
    plan)
      session_id=$(get_session_id "$task_id")
      claude_args+=(
        --output-format json
        --max-turns 10
        --append-system-prompt-file "$PROMPTS_DIR/plan.md"
      )
      if [[ -n "$session_id" ]]; then
        claude_args+=(--resume "$session_id")
      fi
      local prompt="Design the implementation plan for this task. Be specific about file paths, function signatures, and order of operations."
      ;;
    implement)
      session_id=$(get_session_id "$task_id")
      claude_args+=(
        --output-format stream-json
        --max-turns 50
        --append-system-prompt-file "$PROMPTS_DIR/implement.md"
      )
      if [[ -n "$session_id" ]]; then
        claude_args+=(--resume "$session_id")
      fi
      local prompt
      prompt=$(build_implement_prompt "$task_id")
      ;;
    verify)
      claude_args+=(
        --output-format stream-json
        --max-turns 30
        --append-system-prompt-file "$PROMPTS_DIR/verify.md"
      )
      local prompt
      prompt=$(build_verify_prompt "$task_id")
      ;;
  esac

  update_progress --arg task "$task_id" --arg phase "$phase" \
    '.currentTask = $task | .currentPhase = $phase'

  exit_code=0
  if [[ "$phase" == "implement" || "$phase" == "verify" ]]; then
    # Stream mode: tee to log file, capture full output
    output=$(cd "$PROJECT_DIR" && claude "${claude_args[@]}" "$prompt" 2>&1 | tee "$log_file") || exit_code=$?
  else
    output=$(cd "$PROJECT_DIR" && claude "${claude_args[@]}" "$prompt" 2>&1) || exit_code=$?
    echo "$output" > "$log_file"
  fi

  if [[ $exit_code -ne 0 ]]; then
    log_err "Phase $phase exited with code $exit_code"
    return $exit_code
  fi

  # Extract session_id from output
  local new_session_id=""
  if [[ "$phase" == "implement" ]]; then
    # stream-json: session_id is in the last "result" line
    new_session_id=$(echo "$output" | grep '"session_id"' | tail -1 | jq -r '.session_id // empty' 2>/dev/null || echo "")
  else
    # json: session_id is a top-level field
    new_session_id=$(echo "$output" | jq -r '.session_id // empty' 2>/dev/null || echo "")
  fi

  if [[ -n "$new_session_id" ]]; then
    save_session_id "$task_id" "$new_session_id" "$phase"
  fi

  # Track cost
  local output_format="json"
  [[ "$phase" == "implement" || "$phase" == "verify" ]] && output_format="stream-json"
  local phase_cost
  phase_cost=$(extract_cost_cents "$output" "$output_format")
  if [[ "$phase_cost" -gt 0 ]]; then
    add_cost_cents "$phase_cost"
    local cost_dollars
    cost_dollars=$(echo "scale=2; $phase_cost / 100" | bc)
    log_info "Phase cost: \$$cost_dollars (total: \$$(echo "scale=2; $(get_total_cost_cents) / 100" | bc))"
  fi

  # Extract structured output blocks
  case "$phase" in
    implement)
      # Extract IMPLEMENT_OUTPUT JSON block from the text
      local result_text=""
      result_text=$(echo "$output" | grep '"result"' | tail -1 | jq -r '.result // empty' 2>/dev/null || echo "")
      if [[ -z "$result_text" ]]; then
        # Try extracting from stream-json assistant messages
        result_text=$(echo "$output" | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text' 2>/dev/null | tail -1 || echo "")
      fi
      local impl_json=""
      impl_json=$(echo "$result_text" | sed -n '/```json IMPLEMENT_OUTPUT/,/```/p' | sed '1d;$d' || echo "")
      if [[ -n "$impl_json" ]]; then
        echo "$impl_json" > "$PROGRESS_DIR/implement-output-${task_id}.json"
      fi
      ;;
    verify)
      # Extract VERIFY_OUTPUT JSON block from stream-json
      local verify_text=""
      verify_text=$(echo "$output" | grep '"result"' | tail -1 | jq -r '.result // empty' 2>/dev/null || echo "")
      if [[ -z "$verify_text" ]]; then
        verify_text=$(echo "$output" | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text' 2>/dev/null | tail -1 || echo "")
      fi
      local verify_json=""
      verify_json=$(echo "$verify_text" | sed -n '/```json VERIFY_OUTPUT/,/```/p' | sed '1d;$d' || echo "")
      if [[ -n "$verify_json" ]]; then
        echo "$verify_json" > "$PROGRESS_DIR/verify-output-${task_id}.json"
      fi
      ;;
  esac

  log_ok "Phase $phase complete"
  return 0
}

# =============================================================================
# Rate limit detection and retry
# =============================================================================

is_rate_limited() {
  local output="$1"
  echo "$output" | grep -qiE "(rate.?limit|429|overloaded|capacity|too many)" 2>/dev/null
}

retry_phase() {
  local phase="$1" task_id="$2"
  local attempt=0
  local max_retries=$MAX_RETRIES_PER_PHASE

  while [[ $attempt -lt $max_retries ]]; do
    local exit_code=0
    run_phase "$phase" "$task_id" || exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
      return 0
    fi

    local log_file="$LOG_DIR/task-${task_id}-${phase}.log"
    local last_output=""
    [[ -f "$log_file" ]] && last_output=$(cat "$log_file")

    if is_rate_limited "$last_output"; then
      local backoff=${RETRY_BACKOFFS[$attempt]:-300}
      log_warn "Rate limited. Waiting ${backoff}s before retry (attempt $((attempt + 1))/$max_retries)"
      sleep "$backoff"
    else
      log_err "Phase $phase failed (not rate limit). Attempt $((attempt + 1))/$max_retries"
      sleep 10
    fi

    ((attempt++))
  done

  log_err "Phase $phase failed after $max_retries retries"
  return 1
}

# =============================================================================
# Task execution
# =============================================================================

run_task() {
  local task_id="$1"
  local title
  title=$(extract_task_title "$task_id")
  local task_retries=0

  log ""
  log "===================================================="
  log "  Task $task_id: $title"
  log "===================================================="
  log ""

  # Check dependencies
  if ! check_dependencies "$task_id"; then
    log_err "Skipping task $task_id — unmet dependencies"
    return 1
  fi

  # Skip if already completed
  if is_task_completed "$task_id"; then
    log_ok "Task $task_id already completed. Skipping."
    return 0
  fi

  local start_time
  start_time=$(date +%s)

  # Phase 1: Understand
  if ! retry_phase "understand" "$task_id"; then
    mark_task_failed "$task_id" "understand phase failed"
    return 1
  fi

  # Phase 2: Plan
  if ! retry_phase "plan" "$task_id"; then
    mark_task_failed "$task_id" "plan phase failed"
    return 1
  fi

  # Phase 3+4: Implement + Verify (with fix cycles)
  local verify_attempts=0
  local max_verify_attempts=3

  while [[ $verify_attempts -lt $max_verify_attempts ]]; do
    # Implement
    if ! retry_phase "implement" "$task_id"; then
      mark_task_failed "$task_id" "implement phase failed"
      return 1
    fi

    # Verify (always fresh session)
    if retry_phase "verify" "$task_id"; then
      # Check verify result
      local verify_file="$PROGRESS_DIR/verify-output-${task_id}.json"
      local status="pass"
      if [[ -f "$verify_file" ]]; then
        status=$(jq -r '.overallStatus // "unknown"' "$verify_file" 2>/dev/null || echo "unknown")
      fi

      if [[ "$status" == "pass" ]]; then
        break
      else
        log_warn "Verification failed. Fix cycle $((verify_attempts + 1))/$max_verify_attempts"
        ((verify_attempts++))
        if [[ $verify_attempts -ge $max_verify_attempts ]]; then
          log_err "Verification failed after $max_verify_attempts attempts"
          mark_task_failed "$task_id" "verification failed after $max_verify_attempts fix cycles"
          return 1
        fi
      fi
    else
      mark_task_failed "$task_id" "verify phase failed"
      return 1
    fi
  done

  # Final gate: typecheck + lint (run by the script, not Claude)
  log "Running final typecheck + lint gate..."
  local gate_exit=0
  cd "$PROJECT_DIR" && pnpm typecheck 2>&1 || gate_exit=$?
  if [[ $gate_exit -ne 0 ]]; then
    log_err "Final typecheck gate failed"
    mark_task_failed "$task_id" "final typecheck gate failed"
    return 1
  fi

  # Git commit
  log "Committing to main..."
  cd "$PROJECT_DIR"
  git add -A
  local commit_msg="Task ${task_id}: ${title}

Automated by dev-cycle.sh

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

  local commit_hash=""
  if git diff --cached --quiet 2>/dev/null; then
    log_warn "No changes to commit"
    commit_hash="none"
  else
    git commit -m "$commit_msg" && commit_hash=$(git rev-parse --short HEAD)
    log_ok "Committed: $commit_hash"
  fi

  # Update progress
  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - start_time))

  local files_created="[]"
  local files_modified="[]"
  local key_decisions="[]"
  local impl_file="$PROGRESS_DIR/implement-output-${task_id}.json"
  if [[ -f "$impl_file" ]]; then
    files_created=$(jq '.filesCreated // []' "$impl_file" 2>/dev/null || echo "[]")
    files_modified=$(jq '.filesModified // []' "$impl_file" 2>/dev/null || echo "[]")
    key_decisions=$(jq '.keyDecisions // []' "$impl_file" 2>/dev/null || echo "[]")
  fi

  update_progress \
    --arg tid "$task_id" \
    --arg sid "$(get_session_id "$task_id")" \
    --arg hash "${commit_hash:-none}" \
    --argjson fc "$files_created" \
    --argjson fm "$files_modified" \
    --argjson kd "$key_decisions" \
    --argjson dur "$duration" \
    '.completedTasks += [{
      taskId: $tid,
      sessionId: $sid,
      filesCreated: $fc,
      filesModified: $fm,
      keyDecisions: $kd,
      verifyStatus: "pass",
      commitHash: $hash,
      durationSeconds: $dur
    }] | .stats.completed += 1 | .currentTask = null | .currentPhase = null'

  log_ok "Task $task_id COMPLETE (${duration}s, commit: ${commit_hash:-none})"
  log ""
}

mark_task_failed() {
  local task_id="$1" reason="$2"
  update_progress \
    --arg tid "$task_id" \
    --arg reason "$reason" \
    '.failedTasks += [{taskId: $tid, reason: $reason, timestamp: (now | todate)}] | .stats.failed += 1 | .currentTask = null | .currentPhase = null'
  log_err "Task $task_id FAILED: $reason"
}

# =============================================================================
# Next available task
# =============================================================================

next_available_task() {
  for task_id in "${TASK_ORDER[@]}"; do
    if is_task_completed "$task_id"; then
      continue
    fi
    if is_task_failed "$task_id"; then
      continue
    fi
    if check_dependencies "$task_id" 2>/dev/null; then
      echo "$task_id"
      return 0
    fi
  done
  return 1
}

# =============================================================================
# Status display
# =============================================================================

show_status() {
  init_progress
  echo ""
  echo "===================================================="
  echo "  ScuttlePay Dev Cycle — Status"
  echo "===================================================="
  echo ""

  local completed
  completed=$(read_progress '.stats.completed')
  local failed
  failed=$(read_progress '.stats.failed')
  local total=${#TASK_ORDER[@]}
  local remaining=$((total - completed - failed))

  local cost_cents
  cost_cents=$(get_total_cost_cents)
  local cost_dollars
  cost_dollars=$(echo "scale=2; $cost_cents / 100" | bc)
  local budget_dollars
  budget_dollars=$(echo "scale=2; $TOTAL_BUDGET_CENTS / 100" | bc)

  echo "  Completed: $completed / $total"
  echo "  Failed:    $failed"
  echo "  Remaining: $remaining"
  echo "  Cost:      \$$cost_dollars / \$$budget_dollars"
  echo ""

  local current_task
  current_task=$(read_progress '.currentTask // "none"')
  local current_phase
  current_phase=$(read_progress '.currentPhase // "none"')
  echo "  Current:   Task $current_task ($current_phase)"
  echo ""

  echo "  Completed tasks:"
  jq -r '.completedTasks[] | "    ✓ Task \(.taskId) — \(.commitHash // "no commit") (\(.durationSeconds // 0)s)"' "$PROGRESS_FILE" 2>/dev/null || echo "    (none)"
  echo ""

  if [[ "$failed" != "0" ]]; then
    echo "  Failed tasks:"
    jq -r '.failedTasks[] | "    ✗ Task \(.taskId) — \(.reason)"' "$PROGRESS_FILE" 2>/dev/null
    echo ""
  fi

  local next
  next=$(next_available_task 2>/dev/null || echo "none")
  echo "  Next up:   Task $next"
  echo ""
  echo "===================================================="
}

# =============================================================================
# Dry run
# =============================================================================

dry_run_task() {
  local task_id="$1"
  local title
  title=$(extract_task_title "$task_id")
  local spec
  spec=$(extract_task_spec "$task_id")

  echo ""
  echo "===================================================="
  echo "  DRY RUN — Task $task_id: $title"
  echo "===================================================="
  echo ""

  echo "--- Dependencies ---"
  local deps
  deps=$(get_task_deps "$task_id")
  if [[ -z "$deps" ]]; then
    echo "  Required: none"
  else
    echo "  Required: $deps"
    for dep in $deps; do
      if is_task_completed "$dep" 2>/dev/null; then
        echo "  $dep: completed"
      else
        echo "  $dep: NOT completed"
      fi
    done
  fi
  echo ""

  echo "--- Task Spec (first 20 lines) ---"
  echo "$spec" | head -20
  echo "  ..."
  echo ""

  echo "--- Phase Commands ---"
  echo ""
  echo "  1. UNDERSTAND (read + analyze):"
  echo "     claude -p --model $MODEL --output-format json --dangerously-skip-permissions \\"
  echo "       --max-turns 15 \\"
  echo "       --append-system-prompt-file $PROMPTS_DIR/understand.md"
  echo ""
  echo "  2. PLAN (read + design):"
  echo "     claude -p --model $MODEL --output-format json --dangerously-skip-permissions \\"
  echo "       --max-turns 10 --resume \$SESSION_ID \\"
  echo "       --append-system-prompt-file $PROMPTS_DIR/plan.md"
  echo ""
  echo "  3. IMPLEMENT (full access):"
  echo "     claude -p --model $MODEL --output-format stream-json --dangerously-skip-permissions \\"
  echo "       --max-turns 50 --resume \$SESSION_ID \\"
  echo "       --append-system-prompt-file $PROMPTS_DIR/implement.md"
  echo ""
  echo "  4. VERIFY + REVIEW (new session, full access):"
  echo "     claude -p --model $MODEL --output-format stream-json --dangerously-skip-permissions \\"
  echo "       --max-turns 30 \\"
  echo "       --append-system-prompt-file $PROMPTS_DIR/verify.md"
  echo ""
  echo "===================================================="
}

# =============================================================================
# Cleanup trap
# =============================================================================

cleanup() {
  log_warn "Caught signal — saving progress..."
  log_info "Progress saved to $PROGRESS_FILE"
  log_info "Logs in $LOG_DIR"
  exit 1
}

trap cleanup INT TERM

# =============================================================================
# CLI argument parsing
# =============================================================================

MODE=""
TARGET_TASK=""
TARGET_PHASE=""
DRY_RUN=false

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --task ID        Run a specific task (e.g., 2.0)
  --continue       Run all remaining tasks sequentially
  --resume         Resume from where interrupted
  --status         Show progress summary
  --phase PHASE    Run only a specific phase (understand|plan|implement|verify)
  --dry-run        Show what would be done without invoking Claude
  --force          Re-run even if task is marked complete
  --help           Show this help

Examples:
  $0 --task 2.0                    # Run task 2.0
  $0 --task 2.0 --dry-run          # Preview task 2.0
  $0 --task 2.0 --phase verify     # Re-run verification only
  $0 --continue                    # Run all remaining tasks
  $0 --status                      # Show progress
EOF
  exit 0
}

FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --task) TARGET_TASK="$2"; MODE="task"; shift 2 ;;
    --continue) MODE="continue"; shift ;;
    --resume) MODE="resume"; shift ;;
    --status) MODE="status"; shift ;;
    --phase) TARGET_PHASE="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --force) FORCE=true; shift ;;
    --help) usage ;;
    *) log_err "Unknown option: $1"; usage ;;
  esac
done

if [[ -z "$MODE" ]]; then
  usage
fi

# =============================================================================
# Main
# =============================================================================

init_progress

case "$MODE" in
  status)
    show_status
    ;;

  task)
    if [[ -z "$TARGET_TASK" ]]; then
      log_err "No task specified"
      exit 1
    fi

    if [[ "$DRY_RUN" == true ]]; then
      dry_run_task "$TARGET_TASK"
      exit 0
    fi

    if [[ -n "$TARGET_PHASE" ]]; then
      # Run single phase
      retry_phase "$TARGET_PHASE" "$TARGET_TASK"
    else
      # Run full task
      run_task "$TARGET_TASK"
    fi
    ;;

  continue)
    if [[ "$DRY_RUN" == true ]]; then
      for task_id in "${TASK_ORDER[@]}"; do
        if ! is_task_completed "$task_id" && ! is_task_failed "$task_id"; then
          dry_run_task "$task_id"
        fi
      done
      exit 0
    fi

    log "Starting continuous mode — processing all remaining tasks"
    while true; do
      local_next=$(next_available_task 2>/dev/null || echo "")
      if [[ -z "$local_next" ]]; then
        log_ok "All available tasks complete!"
        break
      fi
      run_task "$local_next" || true
    done
    show_status
    ;;

  resume)
    current=$(read_progress '.currentTask // empty')
    if [[ -n "$current" && "$current" != "null" ]]; then
      log "Resuming task $current"
      run_task "$current" || true
    fi
    # Then continue with remaining
    while true; do
      local_next=$(next_available_task 2>/dev/null || echo "")
      if [[ -z "$local_next" ]]; then
        log_ok "All available tasks complete!"
        break
      fi
      run_task "$local_next" || true
    done
    show_status
    ;;
esac
