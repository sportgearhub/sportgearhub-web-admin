import { Card, CardContent, CardHeader } from '../../components/ui/card'

type AuthFrameProps = {
  children: React.ReactNode
}

export function AuthFrame({ children }: AuthFrameProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-[420px]">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">
              S
            </span>
            <div>
              <strong className="block text-sm font-semibold">Sportgearhub</strong>
              <span className="block text-xs text-muted-foreground">Внутренняя консоль</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
    </main>
  )
}
