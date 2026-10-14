import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  return (
    <main className="login">
      <form action={login} className="card login-card">
        <p className="brand">Eco-Locaux</p>
        <h1>Espace commerciaux</h1>
        <label>
          E-mail
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        {erreur && <p className="error">E-mail ou mot de passe incorrect.</p>}
        <button type="submit">Se connecter</button>
      </form>
    </main>
  );
}
