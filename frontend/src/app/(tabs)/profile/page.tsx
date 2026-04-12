'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { useLocation } from '@/context/LocationContext';
import { useEffect, useState } from 'react';
import { Loader, MapPin, AlertCircle, Check, Bell, Settings2, LogOut, BadgeInfo } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { emitLocationUpdatedToast } from '@/lib/locationEvents';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading: userLoading, updateProfile } = useUser();
  const { setLocation } = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    location_name: '',
    latitude: 0,
    longitude: 0,
    land_area: 0,
    primary_crop: '',
    language: 'English',
  });

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
    if (profile) {
      setFormData({
        name: profile.name,
        location_name: profile.location_name,
        latitude: profile.latitude,
        longitude: profile.longitude,
        land_area: profile.land_area,
        primary_crop: profile.primary_crop,
        language: profile.language,
      });
    }
  }, [user, userLoading, router, profile]);

  const requestGPSLocation = async () => {
    setGpsLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lon } = position.coords;
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lon }));

        // Reverse geocode
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
          );
          const data = await response.json();
          const locationName =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county ||
            'Your Location';
          setFormData((prev) => ({ ...prev, location_name: locationName }));
        } catch (err) {
          console.error('Reverse geocoding failed:', err);
          setFormData((prev) => ({
            ...prev,
            location_name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          }));
        }

        setGpsLoading(false);
      },
      (error) => {
        setError(`GPS Error: ${error.message}`);
        setGpsLoading(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      await updateProfile({
        name: formData.name,
        location_name: formData.location_name,
        latitude: formData.latitude,
        longitude: formData.longitude,
        land_area: formData.land_area,
        primary_crop: formData.primary_crop,
        language: formData.language,
      });

      if (Number.isFinite(formData.latitude) && Number.isFinite(formData.longitude) && formData.latitude !== 0 && formData.longitude !== 0) {
        setLocation(formData.latitude, formData.longitude, formData.location_name);
        emitLocationUpdatedToast();
      }

      setSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
    }
  };

  if (userLoading) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <Loader className="w-8 h-8 text-green-600 animate-spin" />
      </main>
    );
  }

  return (
    <main className="text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        {/* Header Section */}
        <section className="rounded-4xl border border-lime-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(48,83,23,0.08)] sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lime-700">Farmer Profile</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">Your Profile</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Manage your personal details and app preferences for a tailored farming experience.
              </p>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-2xl bg-lime-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-800 transition"
              >
                Edit Profile
              </button>
            )}
          </div>
        </section>

        {error && (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-[1.5rem] border border-green-200 bg-green-50 px-6 py-4 text-sm text-green-700 flex items-start gap-3">
            <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        {/* Account Info Section */}
        <section className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Account Information</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Email</p>
              <p className="mt-2 font-medium text-slate-900">{user?.email}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Account Created</p>
              <p className="mt-2 font-medium text-slate-900">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Not available'}
              </p>
            </div>
          </div>
        </section>

        {/* Personal Information Section */}
        {!isEditing ? (
          <section className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">Personal Information</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Name</p>
                <p className="mt-2 font-medium text-slate-900">{profile?.name || 'Not set'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Location</p>
                <p className="mt-2 font-medium text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {profile?.location_name || 'Not set'}
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/select-location')}
                  className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Change Location
                </button>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Land Area</p>
                <p className="mt-2 font-medium text-slate-900">{profile?.land_area || 0} acres</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Primary Crop</p>
                <p className="mt-2 font-medium text-slate-900">{profile?.primary_crop || 'Not set'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Language</p>
                <p className="mt-2 font-medium text-slate-900">{profile?.language || 'English'}</p>
              </div>
              {profile?.latitude !== 0 && profile?.longitude !== 0 && profile && (
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Coordinates</p>
                  <p className="mt-2 font-medium text-slate-900 text-sm">
                    {profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)}
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8 space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Edit Profile</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
              />
            </div>

            <div className="space-y-4 p-4 bg-blue-50 rounded-2xl">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">Your Location</label>
                <button
                  type="button"
                  onClick={requestGPSLocation}
                  disabled={gpsLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  {gpsLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Getting...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" />
                      Use GPS
                    </>
                  )}
                </button>
              </div>

              <input
                type="text"
                value={formData.location_name}
                onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
              />

              {formData.latitude !== 0 && formData.longitude !== 0 && (
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Coordinates: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Land Area (acres)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.land_area}
                onChange={(e) => setFormData({ ...formData, land_area: parseFloat(e.target.value) })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Primary Crop</label>
              <select
                value={formData.primary_crop}
                onChange={(e) => setFormData({ ...formData, primary_crop: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
              >
                <option value="">Select a crop</option>
                <option value="Rice">Rice</option>
                <option value="Wheat">Wheat</option>
                <option value="Corn">Corn</option>
                <option value="Cotton">Cotton</option>
                <option value="Sugarcane">Sugarcane</option>
                <option value="Vegetables">Vegetables</option>
                <option value="Fruits">Fruits</option>
                <option value="Spices">Spices</option>
                <option value="Pulses">Pulses</option>
                <option value="Oilseeds">Oilseeds</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Language</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-100"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-lime-700 hover:bg-lime-800 text-white font-semibold py-3 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                  if (profile) {
                    setFormData({
                      name: profile.name,
                      location_name: profile.location_name,
                      latitude: profile.latitude,
                      longitude: profile.longitude,
                      land_area: profile.land_area,
                      primary_crop: profile.primary_crop,
                      language: profile.language,
                    });
                  }
                }}
                className="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-900 font-semibold py-3 rounded-2xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Settings Section */}
        <section className="rounded-[2rem] border border-lime-100 bg-white/95 p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Settings2 className="h-5 w-5 text-lime-700" />
            Preferences
          </div>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <span>Weather alerts</span>
              <BadgeInfo className="h-4 w-4 text-lime-700" />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <span>Market reminders</span>
              <BadgeInfo className="h-4 w-4 text-lime-700" />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <span>Irrigation schedule</span>
              <BadgeInfo className="h-4 w-4 text-lime-700" />
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="rounded-[2rem] border border-lime-100 bg-lime-50/80 p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Bell className="h-5 w-5 text-lime-700" />
            Notification Summary
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Your account is set up for timely agronomy updates, market changes, and assistant reminders.
          </p>
        </section>

        {/* Logout Section */}
        <section className="rounded-[2rem] border border-red-200 bg-red-50/80 p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <LogOut className="h-5 w-5 text-red-700" />
                Sign Out
              </h3>
              <p className="mt-1 text-sm text-slate-700">Sign out from your account</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-2xl transition"
            >
              Logout
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
