# PRODPLAN — Deployment Guide
## No coding needed. Follow these steps exactly.

---

## STEP 1 — Set up Supabase (your database + login system)

1. Go to https://supabase.com and click **Start your project**
2. Sign up with Google or email (free)
3. Click **New Project**, give it a name like `prodplan`, set a password, choose a region close to India (e.g. Singapore)
4. Wait ~2 minutes for it to set up
5. In the left sidebar click **SQL Editor**
6. Click **New Query**
7. Open the file `SUPABASE_SETUP.sql` from this folder, copy ALL of its contents, paste into the editor
8. Click **Run** — you should see "Success"
9. Now go to **Project Settings** (gear icon) → **API**
10. Copy these two values — you'll need them soon:
    - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
    - **anon public** key (long string starting with `eyJ...`)

---

## STEP 2 — Upload the code to GitHub

1. Go to https://github.com and sign up / sign in (free)
2. Click the **+** button → **New repository**
3. Name it `prodplan`, keep it **Private**, click **Create repository**
4. On your computer, open the `prodplan` folder you downloaded
5. Go to https://github.com/your-username/prodplan
6. Click **uploading an existing file** link
7. Drag and drop ALL files and folders from the `prodplan` folder
8. Click **Commit changes**

---

## STEP 3 — Deploy on Vercel (makes it a live website)

1. Go to https://vercel.com and sign up with your GitHub account
2. Click **Add New Project**
3. Find your `prodplan` repository and click **Import**
4. Before clicking Deploy, click **Environment Variables** and add:
   - Name: `NEXT_PUBLIC_SUPABASE_URL`   Value: *(paste your Supabase Project URL)*
   - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`  Value: *(paste your anon key)*
5. Click **Deploy**
6. Wait ~2 minutes — Vercel will give you a URL like `https://prodplan-yourname.vercel.app`

---

## STEP 4 — Enable Email Sign-ups in Supabase

1. In Supabase, go to **Authentication** → **Providers**
2. Make sure **Email** is enabled (it is by default)
3. Go to **Authentication** → **Email Templates** if you want to customise the confirmation email

---

## STEP 5 — Share with your team

- Share your Vercel URL (e.g. `https://prodplan-yourname.vercel.app`) with anyone
- They click **Create Account**, enter their email + password, confirm via email, then log in
- Each user's orders are **private** — only they can see their own data
- To give all users access to the same orders, let me know and I can update the app

---

## Your app is now live! 🎉

- **URL**: your Vercel link
- **Login**: email + password (each person creates their own account)
- **Data**: stored securely in Supabase (free tier handles up to 500MB and 50,000 users)

---

## Need help?

If you get stuck on any step, copy the error message and ask Claude — I'll help you fix it instantly.
