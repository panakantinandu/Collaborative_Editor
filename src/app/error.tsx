"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="center-state"><h1>Something interrupted your workspace.</h1><p>Try again to pick up where you left off.</p><Button onClick={reset}>Try again</Button></main>; }
