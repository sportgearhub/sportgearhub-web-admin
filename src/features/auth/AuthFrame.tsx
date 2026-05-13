type AuthFrameProps = {
  children: React.ReactNode
}

export function AuthFrame({ children }: AuthFrameProps) {
  return (
    <main className="sign-in-shell">
      <section className="sign-in-panel">
        <div className="sign-in-brand">
          <span className="mark" aria-hidden="true">
            S
          </span>
          <div>
            <strong>Sportgearhub</strong>
            <span>Внутренняя консоль</span>
          </div>
        </div>

        {children}
      </section>
    </main>
  )
}
