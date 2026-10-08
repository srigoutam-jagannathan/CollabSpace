<div align="center">

<img src="assets/collabspace-logo.png" alt="CollabSpace logo: four puzzle pieces coming together" width="280" />

# CollabSpace

**Find your people. Build the thing.**

A project-collaboration app for students at Queen's University Belfast and Ulster University:
pitch an idea, find teammates with the right skills, and see it through to launch.

[![CI](https://github.com/srigoutam-jagannathan/CollabSpace/actions/workflows/test.yml/badge.svg)](https://github.com/srigoutam-jagannathan/CollabSpace/actions/workflows/test.yml)
![Expo SDK 57](https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E?logo=supabase&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)

[Report a bug](https://github.com/srigoutam-jagannathan/CollabSpace/issues/new?template=bug.yml) ·
[Suggest a change](https://github.com/srigoutam-jagannathan/CollabSpace/issues/new?template=task.yml) ·
[Open issues](https://github.com/srigoutam-jagannathan/CollabSpace/issues)

</div>

---

## ✨ What you can do

| | |
| --- | --- |
| 🧭 **Discover** | Browse projects looking for help, ranked for you, or search by skill and tag. |
| 🚀 **Pitch** | Post a project, say who you're looking for, and give it an icon and photos. |
| 🤝 **Join** | Ask to join. The owner approves you, and you commit when you're in. |
| 💬 **Chat** | Every project gets a group chat, and you can message anyone directly. |
| 🔔 **Stay on top** | Join requests, invitations and connection requests land in one place. |
| 🧠 **Plan with AI** | Get ready-made Legal, Tech and Marketing prompts to paste into your own AI assistant. |
| 🏆 **Ship** | Finished projects move to the archive, so your work stays on show. |

## 🔒 University only

Only `@qub.ac.uk` and `@ulster.ac.uk` Microsoft accounts can sign in. The app checks your address,
and the database enforces it again on every table and upload, so nobody gets in through the back door.

## 🧱 Built with

- **App:** Expo SDK 57, React Native, Expo Router, TypeScript
- **Backend:** Supabase (Postgres with row-level security, Auth via Microsoft Entra ID, Storage,
  Realtime and Edge Functions)
- **Tests:** Jest and React Native Testing Library, pgTAP for database rules, Deno for Edge Functions,
  all run in CI on every push

## 🚀 Getting started

You'll need Node.js, the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker (for the local
database), and [Expo Go](https://expo.dev/go) on your phone.

```bash
git clone https://github.com/srigoutam-jagannathan/CollabSpace.git
cd CollabSpace
npm install
cp .env.example .env.local   # then fill in your Supabase URL and anon key
npx expo start               # scan the QR code with Expo Go
```

To try it from a phone that isn't on your network, run `npx expo start --tunnel`.

## 🧪 Checks

```bash
npm run type-check   # TypeScript
npm run lint         # ESLint
npm run test:ci      # Jest, with coverage floors
supabase start && supabase db reset && npm run test:db   # database rules (pgTAP)
deno test supabase/functions/                            # Edge Functions
```

## 🗂️ Where things live

```
app/                  screens (Expo Router: (auth) for sign-in, (app) for everything else)
src/features/         auth, discover, projects, chat, notifications, archive
src/components/       shared UI
src/lib/              Supabase client and helpers
supabase/migrations/  database schema and security rules
supabase/functions/   Edge Functions
supabase/tests/       pgTAP tests for the database rules
```

Contributors: [`CLAUDE.md`](CLAUDE.md) covers the architecture and the rules the database enforces.

## 🐞 Testing the app?

Thank you! File what you find on GitHub:

- **[Bug report](https://github.com/srigoutam-jagannathan/CollabSpace/issues/new?template=bug.yml)**
  for something that's broken
- **[Change request](https://github.com/srigoutam-jagannathan/CollabSpace/issues/new?template=task.yml)**
  for something that works but could be better

This repo is public, so please don't post real email addresses or private messages in an issue.

<div align="center">
<br />
<sub>Made in Belfast 🧩</sub>
</div>
