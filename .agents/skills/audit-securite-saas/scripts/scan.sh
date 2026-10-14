#!/usr/bin/env bash
# scan.sh — premier passage automatique d'un audit de sécurité.
# Usage : bash scripts/scan.sh [chemin_du_projet]
#
# Ce script ne conclut rien : il rassemble en une passe les signaux bruts
# des contrôles 1, 2, 3, 6, 8, 13, 15, 17, 20. Chaque résultat doit ensuite
# être ouvert et confirmé — voir la section « faux positifs » de checklist.md.

set -uo pipefail
CIBLE="${1:-.}"
cd "$CIBLE" || { echo "Chemin introuvable : $CIBLE"; exit 1; }

EXCLURE=(--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist
         --exclude-dir=build --exclude-dir=.next --exclude-dir=vendor
         --exclude-dir=.venv --exclude-dir=coverage)
CODE=(--include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"
      --include="*.vue" --include="*.svelte" --include="*.html" --include="*.py" --include="*.mjs")

titre() { printf '\n=== %s ===\n' "$1"; }
rien()  { echo "  (rien trouvé)"; }
lancer() { local sortie; sortie=$(eval "$1" 2>/dev/null | head -25); [ -n "$sortie" ] && echo "$sortie" || rien; }

echo "AUDIT — scan automatique de : $(pwd)"
echo "Date : $(date '+%Y-%m-%d %H:%M')"

titre "Contexte du projet"
for f in package.json requirements.txt composer.json next.config.js next.config.mjs vercel.json netlify.toml Dockerfile; do
  [ -f "$f" ] && echo "  présent : $f"
done
[ -f package.json ] && echo "  dépendances :" && node -e "
const p=require('./package.json');
console.log('   ', Object.keys({...p.dependencies||{}, ...p.devDependencies||{}}).join(', ').slice(0,400));
" 2>/dev/null

titre "1. Secrets et clés API en clair"
lancer "grep -rEn \"sk-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{10,}|rk_live_|AIza[0-9A-Za-z_-]{30,}|xoxb-[0-9]|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC )?PRIVATE KEY-----\" ${CODE[*]} --include='*.json' --include='*.yml' ${EXCLURE[*]} ."

titre "1b. Variables exposées au navigateur (préfixes publics)"
lancer "grep -rEn \"NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_\" --include='.env*' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' ${EXCLURE[*]} . | grep -viE 'PUBLIC_(SUPABASE_URL|SUPABASE_ANON|API_URL|SITE_URL|APP_URL|POSTHOG|GA_|GTM|SENTRY_DSN)'"

titre "2. Secrets dans Git"
if [ -d .git ]; then
  echo "  fichiers sensibles dans l'historique :"
  git log --all --full-history --name-only --pretty=format: 2>/dev/null \
    | sort -u | grep -Ei "^\.env($|\.)|credential|secret|\.pem$|\.key$|serviceaccount" | head -15 || rien
  echo "  .env ignoré par git :"
  grep -qE "^\.?env" .gitignore 2>/dev/null && echo "    oui" || echo "    NON — .gitignore ne couvre pas .env"
  echo "  .env actuellement suivi par git :"
  git ls-files 2>/dev/null | grep -E "^\.env" | head -5 || echo "    non"
else
  echo "  (pas de dépôt git ici)"
fi

titre "3. Clé service_role / admin côté client"
lancer "grep -rn \"service_role\|SERVICE_ROLE\|serviceAccountKey\|firebase-admin\|SUPABASE_SERVICE\" ${CODE[*]} ${EXCLURE[*]} ."
echo "  --- appels createClient (vérifier la clé passée dans chacun) ---"
lancer "grep -rn \"createClient(\" ${CODE[*]} ${EXCLURE[*]} ."

titre "6/7. Identité prise chez le client au lieu de la session"
lancer 'grep -rEn "query\(.*\+ *[a-zA-Z_]|execute\(.*%s" '"${CODE[*]} ${EXCLURE[*]} ."

titre "6b. Contrôle d'accès fait dans le navigateur (décoratif)"
lancer "grep -rEn \"(role|isAdmin|is_admin|isPremium|is_premium|plan) *===? *['\"]?(admin|premium|pro)|user\.(isAdmin|is_admin|role) *&&\" --include='*.jsx' --include='*.tsx' --include='*.vue' --include='*.svelte' ${EXCLURE[*]} ."

titre "8. Mise à jour en masse du corps de requête"
lancer "grep -rEn \"update\(req\.body\)|update\(body\)|update\(\{ *\.\.\.req\.body|\.set\(req\.body\)\" ${CODE[*]} ${EXCLURE[*]} ."

titre "13. SQL construit par concaténation"
lancer 'grep -rEn "query\(.*\+ *[a-zA-Z_]|execute\(.*%s" '"${CODE[*]} ${EXCLURE[*]} ."

titre "15. Injection de HTML brut (XSS)"
lancer "grep -rn \"dangerouslySetInnerHTML\|innerHTML *=\|v-html\|{@html\" ${CODE[*]} ${EXCLURE[*]} ."

titre "17. Sélections larges dans les requêtes"
lancer "grep -rn \"select('\*')\|select(\"\*\")\|SELECT \* FROM\" ${CODE[*]} ${EXCLURE[*]} ."

titre "Routes de debug / administration oubliées"
lancer "grep -rEni \"(app|router)\.(get|post|put|delete)\([^)]*(test|debug|seed|reset|migrate|admin)\" ${CODE[*]} ${EXCLURE[*]} ."

titre "18/19. Headers et HTTPS"
lancer "grep -rn \"helmet\|Strict-Transport-Security\|X-Frame-Options\|Content-Security-Policy\" ${CODE[*]} --include='*.json' --include='*.toml' ${EXCLURE[*]} ."

titre "11. Rate limiting"
lancer "grep -rn \"rate-limit\|rateLimit\|Ratelimit\|slowDown\" ${CODE[*]} --include='*.json' ${EXCLURE[*]} ."

titre "14. Validation d'entrées"
lancer "grep -rln \"from 'zod'\|from \"zod\"\|require('joi')\|from 'yup'\|superstruct\|valibot\" ${CODE[*]} ${EXCLURE[*]} ."

titre "20. Dépendances"
if [ -f package-lock.json ] || [ -f yarn.lock ] || [ -f pnpm-lock.yaml ]; then
  npm audit --omit=dev 2>/dev/null | tail -12 || echo "  (npm audit indisponible)"
else
  echo "  (pas de lockfile — npm audit impossible)"
fi

printf '\n=== FIN DU SCAN ===\n'
echo "Rappel : chaque ligne ci-dessus est un signal, pas une conclusion."
echo "Ouvrir les fichiers concernés avant de classer quoi que ce soit en 🔴."
echo "La RLS, le hachage des mots de passe, les cookies, les uploads et le chiffrement"
echo "ne sont PAS couverts par ce scan — ils se vérifient dans le dashboard et à la lecture."
