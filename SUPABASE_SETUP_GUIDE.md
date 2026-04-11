# FarmEase: Supabase Setup Guide

This guide will help you set up Supabase for the FarmEase application with complete authentication, personalization, and data storage.

## Prerequisites

- A Supabase account (free tier is sufficient)
- FarmEase project cloned locally
- Node.js and npm installed

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"New Project"** or sign in if you have an account
3. Fill in the project details:
   - **Name**: FarmEase (or your preferred name)
   - **Database Password**: Create a strong password (save it securely)
   - **Region**: Choose the region closest to your users
4. Click **"Create new project"**
5. Wait for the project to initialize (usually takes 1-2 minutes)

## Step 2: Get Your Supabase Credentials

1. After your project is created, go to **Settings** → **API** in the left sidebar
2. Copy the following values:
   - **Project URL**: This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Key**: This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Keep these values safe - you'll need them next

## Step 3: Add Database Schema

1. In the Supabase dashboard, go to **SQL Editor** in the left sidebar
2. Click **"+ New Query"**
3. Open the `SUPABASE_SETUP.sql` file from this project
4. Copy ALL the SQL commands and paste them into the SQL Editor
5. Click **"RUN"** to execute all commands
6. You should see success messages if all tables are created correctly

## Step 4: Configure Your Frontend

1. Open `frontend/.env` in your project
2. Add the credentials from Step 2:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```
3. Save the file

## Step 5: Enable Email Authentication in Supabase

1. Go to **Authentication** → **Providers** in Supabase
2. Make sure **Email** is enabled (it should be by default)
3. Go to **Authentication** → **Email Templates**
4. Optional: Customize the confirmation email template

## Step 6: Configure Email Confirmations (Optional but Recommended)

1. Go to **Authentication** → **Email Templates**
2. Click on **"Confirm signup"** template
3. Customize if needed, then save
4. For testing, you can disable email confirmation:
   - Go to **Authentication** → **Settings**
   - Toggle **"Enable email confirmations"** (enable for production)

## Step 7: Test the Application

1. Start your development server:
   ```bash
   cd frontend
   npm run dev
   ```

2. Navigate to [http://localhost:3000](http://localhost:3000)
3. You should be redirected to login page
4. Click **"Sign up"** and create a test account
5. After signup, complete the onboarding form
6. You should now see the personalized dashboard!

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure you've correctly added `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env`
- Restart your dev server after updating `.env`

### "Email confirmation required"
- Check your email inbox for a confirmation link
- Click it to activate your account
- If you don't see it, check spam folder

### "Geolocation not working"
- HTTPS is required for geolocation (localhost works for development)
- Allow location access when your browser asks
- If still not working, manually enter your location in the form

### Tables not showing in Supabase
- Go to **SQL Editor** and run:
  ```sql
  SELECT * FROM profiles;
  ```
- If you get an error about table not existing, re-run the `SUPABASE_SETUP.sql` file

## Security Notes

1. **Never** share your `NEXT_PUBLIC_SUPABASE_ANON_KEY` publicly
2. Always use environment variables for sensitive data
3. Row-level security (RLS) is enabled on all tables - users can only see their own data
4. For production, follow Supabase's [security checklist](https://supabase.com/docs/guides/database/security-overview)

## Using the Application

### First Time Setup
1. **Register**: Create your account
2. **Onboarding**: Complete your profile with GPS location, crop, and land area
3. **Dashboard**: See personalized content based on your data

### Features
- **Dashboard**: Personalized greeting with your crop and location
- **Crop Advisory**: Get recommendations for YOUR specific crop
- **Weather**: Automatic weather for YOUR saved location
- **Finance**: Schemes recommended based on YOUR land size
- **Market**: See prices relevant to YOUR area
- **Profile**: Edit your information anytime

## Next Steps

- Customize the UI colors in `src/globals.css`
- Add more crops to the crop selector in onboarding
- Integrate the backend services with your user location
- Set up automated emails for weather alerts

## Support

For Supabase-related help, visit: [https://supabase.com/docs](https://supabase.com/docs)
