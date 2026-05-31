# V Silverhand — Companion IA Personnel

*Lire en [anglais](README.md)*

Application web mobile personnelle qui fonctionne comme un assistant IA privé, accessible depuis le téléphone comme une app de messagerie. V Silverhand mémorise toutes les conversations, connaît l'utilisateur grâce à des notes personnelles, analyse des fichiers, et envoie un briefing chaque matin. Entièrement privé, mono-utilisateur, hébergé gratuitement.

---

## À quoi ça sert

La plupart des chatbots oublient tout dès qu'on ferme l'onglet. V Silverhand garde une mémoire persistante, construit un contexte sur l'utilisateur au fil du temps, et reste accessible directement depuis l'écran d'accueil du téléphone.

---

## Fonctionnalités

- **Chat en temps réel** avec une personnalité IA définie
- **Mémoire persistante** entre toutes les conversations
- **Mémoire intelligente** — les anciens messages sont résumés et compressés automatiquement pour un rappel de long terme
- **Panneau de gestion de la mémoire** pour consulter, modifier et supprimer les souvenirs
- **Notes personnelles** toujours injectées dans le contexte de l'IA
- **Upload de fichiers** — analyse de PDFs et d'images
- **Briefing quotidien automatique** chaque matin
- **PWA** — installable sur l'écran d'accueil, en plein écran, sans barre de navigateur
- **Déploiement continu** — chaque modification du code se met en ligne automatiquement

---

## Stack technique

| Composant | Technologie | Coût |
|---|---|---|
| Frontend | HTML / CSS / JavaScript | Gratuit |
| IA | Groq API (LLaMA 3) | Gratuit |
| Base de données / Mémoire | Supabase | Gratuit |
| Hébergement | Vercel | Gratuit |
| Tâches planifiées | Vercel Cron Jobs | Gratuit |
| Versioning | GitHub | Gratuit |

---

## Architecture

Le frontend est servi par Vercel. Les appels sensibles (IA, base de données) passent par des fonctions serverless pour que les clés API ne soient jamais exposées dans le navigateur. Les messages et notes personnelles sont stockés dans Supabase. Un Cron Vercel déclenche le briefing quotidien chaque matin.

```
Téléphone (PWA)
      │
      ▼
Frontend (HTML/CSS/JS) ──► Vercel (hébergement + fonctions serverless)
      │
      ├──► /api/chat.js      ──► Groq API (génération des réponses)
      │         │
      │         ▼
      │    Supabase (messages + notes personnelles)
      │
      └──► /api/briefing.js  ◄── Vercel Cron (tous les matins à 8h)
```

---

## Comment le projet a été construit

Développé en 4 phases, chacune validée sur le téléphone avant de passer à la suivante :

1. **Phase 1** — Interface de chat mobile déployée en ligne (sans IA)
2. **Phase 2** — IA connectée, V répond en temps réel
3. **Phase 3** — Mémoire persistante via Supabase
4. **Phase 4** — Gestion de la mémoire, upload de fichiers, mémoire intelligente, briefing quotidien, PWA

Planification dans Claude (chat) ; exécution du code via Claude Code dans VS Code.

---

## Compétences démontrées

**Architecture de projet** — Découper une idée en phases concrètes et livrables, avec un ordre de construction logique.

**Intégration d'API** — Connecter plusieurs services tiers (IA, base de données, hébergement). Comprendre la différence entre appels côté client et côté serveur, et pourquoi les clés API doivent rester secrètes.

**Base de données** — Concevoir des tables, gérer les relations entre données, construire un système de mémoire persistante avec compression du contexte.

**Déploiement et DevOps** — Pipeline de déploiement continu (GitHub → Vercel), gestion des variables d'environnement, automatisation de tâches planifiées via cron.

**Débogage** — Lire des messages d'erreur (quotas d'API, clés invalides, violations de contraintes), identifier les causes racines et décider quand changer d'approche — ex : abandon de Gemini au profit de Groq face à des limites de quota persistantes.

**Développement assisté par IA** — Structurer des instructions précises pour un agent de code, savoir quand planifier et quand exécuter, garder le contrôle de l'architecture sans écrire chaque ligne manuellement.

**Sécurité et confidentialité** — Garder les clés API hors du frontend, isoler les données utilisateur, choisir des options respectueuses de la vie privée.

---

## Choix techniques notables

- **Groq plutôt que Gemini** — Gemini imposait des limites de quota bloquantes même en usage léger. Groq s'est révélé immédiatement stable et gratuit.
- **Sans login** — L'authentification par lien magique ajoutait de la friction pour une app à usage personnel. Une configuration mono-utilisateur simplifiée a été préférée.
- **Mémoire compressée** — Plutôt que de charger un nombre fixe de messages récents, les anciennes conversations sont résumées pour permettre un rappel de long terme sans saturer la fenêtre de contexte du modèle.

---

## Coût de fonctionnement

**0 €/mois** — tous les services restent dans leurs offres gratuites.
