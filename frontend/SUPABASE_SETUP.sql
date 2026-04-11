-- FarmEase Supabase Database Schema
-- Run these SQL commands in your Supabase SQL editor

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  location_name text,
  latitude float DEFAULT 0,
  longitude float DEFAULT 0,
  land_area float DEFAULT 0,
  primary_crop text,
  language text DEFAULT 'English',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access only their own profile
CREATE POLICY "Users can view and update their own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Create chat_history table
CREATE TABLE chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query text NOT NULL,
  response text NOT NULL,
  agent_type text, -- e.g., 'crop', 'weather', 'finance', 'general'
  created_at timestamp DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access only their own chat history
CREATE POLICY "Users can view and manage their own chat history" ON chat_history
  FOR ALL USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX chat_history_user_id_idx ON chat_history(user_id);
CREATE INDEX chat_history_created_at_idx ON chat_history(created_at DESC);

-- Create crop_diagnosis table
CREATE TABLE crop_diagnosis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text,
  disease text,
  confidence float DEFAULT 0,
  treatment text,
  prevention text,
  created_at timestamp DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE crop_diagnosis ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access only their own diagnoses
CREATE POLICY "Users can view and manage their own crop diagnoses" ON crop_diagnosis
  FOR ALL USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX crop_diagnosis_user_id_idx ON crop_diagnosis(user_id);
CREATE INDEX crop_diagnosis_created_at_idx ON crop_diagnosis(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles table
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
