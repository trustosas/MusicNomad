import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Code, Palette, Zap } from "lucide-react"

export default function HomePage() {
  const features = [
    {
      icon: <Code className="h-6 w-6" />,
      title: "Next.js 15",
      description: "Latest App Router with React Server Components",
    },
    {
      icon: <Palette className="h-6 w-6" />,
      title: "Tailwind CSS v4",
      description: "Latest version with improved performance and features",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "shadcn/ui",
      description: "Beautiful, accessible components built with Radix UI",
    },
    {
      icon: <CheckCircle className="h-6 w-6" />,
      title: "TypeScript",
      description: "Full type safety and excellent developer experience",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Latest Stack
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-balance mb-6 bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Next.js Template
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 text-pretty max-w-2xl mx-auto">
            A modern, production-ready template with Next.js 15, Tailwind CSS v4, shadcn/ui, and TypeScript
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Demo Section */}
        <Card className="max-w-2xl mx-auto border-0 shadow-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Ready to Build</CardTitle>
            <CardDescription>Your template is set up and ready for development</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="font-semibold">
                Get Started
              </Button>
              <Button variant="outline" size="lg">
                View Documentation
              </Button>
            </div>

            <div className="pt-6 border-t">
              <h3 className="font-semibold mb-3 text-center">What's Included:</h3>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>App Router Setup</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Dark Mode Support</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Responsive Design</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>TypeScript Config</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-16 text-slate-500 dark:text-slate-400">
          <p className="text-sm">Built with ❤️ using the latest web technologies</p>
        </div>
      </div>
    </div>
  )
}
