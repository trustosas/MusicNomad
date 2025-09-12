"use client"
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as React from 'react'

export default function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme()
  const current = theme === 'system' ? systemTheme : theme
  const isDark = current === 'dark'

  const toggle = React.useCallback(() => {
    setTheme(isDark ? 'light' : 'dark')
  }, [isDark, setTheme])

  return (
    <Button aria-label="Toggle theme" variant="outline" size="icon" onClick={toggle} className="border-[#7c3aed] text-[#7c3aed] hover:bg-[#7c3aed]/10 focus-visible:border-[#7c3aed] focus-visible:ring-[#7c3aed]/40 dark:border-[#7c3aed] dark:text-[#7c3aed] dark:hover:bg-[#7c3aed]/20">
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
