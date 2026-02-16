"use client"

import { useState } from "react"
import { Play, XIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "~/lib/utils"

const TERMINAL_LINES = [
  { prefix: "$", text: "scuttlepay agent create --name bot-01", delay: 0 },
  { prefix: ">", text: "Agent created. API key: sk_live_****", delay: 0.1 },
  { prefix: ">", text: "Setting spending limit: $100/day", delay: 0.2 },
  { prefix: ">", text: "Agent bot-01 is ready.", delay: 0.3 },
  { prefix: "", text: "", delay: 0.4 },
  { prefix: "$", text: "scuttlepay agent fund --amount 500", delay: 0.5 },
  { prefix: ">", text: "Funded $500.00 USD to bot-01", delay: 0.6 },
  { prefix: ">", text: "Balance: $500.00", delay: 0.7 },
]

export function ProductDemo({ className }: { className?: string }) {
  const [isVideoOpen, setIsVideoOpen] = useState(false)

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label="Watch product demo"
        className="group relative w-full cursor-pointer border-0 bg-transparent p-0 text-left"
        onClick={() => setIsVideoOpen(true)}
      >
        <div className="border border-border bg-card transition-all duration-200 ease-out group-hover:brightness-[0.8]">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <div className="size-2.5 rounded-full bg-red-500/60" />
            <div className="size-2.5 rounded-full bg-yellow-500/60" />
            <div className="size-2.5 rounded-full bg-green-500/60" />
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              terminal
            </span>
          </div>
          <div className="p-4 font-mono text-xs leading-relaxed">
            {TERMINAL_LINES.map((line, i) => (
              <div key={i} className="flex gap-2">
                {line.prefix && (
                  <span
                    className={
                      line.prefix === "$"
                        ? "text-accent"
                        : "text-muted-foreground"
                    }
                  >
                    {line.prefix}
                  </span>
                )}
                <span
                  className={
                    line.prefix === "$"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  {line.text}
                </span>
              </div>
            ))}
            <div className="mt-1 flex gap-2">
              <span className="text-accent">$</span>
              <span className="inline-block h-4 w-1.5 animate-pulse bg-accent" />
            </div>
          </div>
        </div>

        <div className="absolute inset-0 flex scale-[0.9] items-center justify-center transition-all duration-200 ease-out group-hover:scale-100">
          <div className="flex size-20 items-center justify-center rounded-full bg-accent/10 backdrop-blur-md">
            <div className="relative flex size-14 items-center justify-center rounded-full bg-gradient-to-b from-accent/30 to-accent shadow-md transition-all duration-200 ease-out group-hover:scale-110">
              <Play className="size-6 fill-white text-white" />
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isVideoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
                setIsVideoOpen(false)
              }
            }}
            onClick={() => setIsVideoOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative mx-4 aspect-video w-full max-w-4xl md:mx-0"
            >
              <motion.button className="absolute -top-16 right-0 bg-neutral-900/50 p-2 text-white ring-1 backdrop-blur-md">
                <XIcon className="size-5" />
              </motion.button>
              <div className="relative isolate z-[1] size-full overflow-hidden border-2 border-border">
                <iframe
                  src="https://www.youtube.com/embed/OKR_YtCgcXo?autoplay=1"
                  title="ScuttlePay Demo"
                  className="size-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
