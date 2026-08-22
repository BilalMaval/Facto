export default function CheckEmailPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm space-y-3 rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm text-zinc-500">
          We sent you a confirmation link. Click it to finish creating your account.
        </p>
      </div>
    </div>
  )
}
