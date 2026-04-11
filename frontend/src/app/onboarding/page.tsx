'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/lib/supabaseClient';
import { MapPin, Loader, AlertCircle } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [name, setName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [landArea, setLandArea] = useState('');
  const [primaryCrop, setPrimaryCrop] = useState('');
  const [language, setLanguage] = useState('English');
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

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
        setLatitude(lat);
        setLongitude(lon);

        // Reverse geocode to get location name
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
          setLocationName(locationName);
        } catch (err) {
          console.error('Reverse geocoding failed:', err);
          setLocationName(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
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
    setLoading(true);

    if (!user) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    if (!name || !locationName || !landArea || !primaryCrop) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name,
          location_name: locationName,
          latitude,
          longitude,
          land_area: parseFloat(landArea),
          primary_crop: primaryCrop,
          language,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <Loader className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Profile</h1>
          <p className="text-gray-600">Help us personalize your experience</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Location Section */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Your Location</label>
              <button
                type="button"
                onClick={requestGPSLocation}
                disabled={gpsLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {gpsLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Getting location...
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
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="City, District, or State"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />

            {latitude !== 0 && longitude !== 0 && (
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Coordinates: {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </p>
            )}
          </div>

          {/* Land Area */}
          <div>
            <label htmlFor="landArea" className="block text-sm font-medium text-gray-700 mb-2">
              Land Area (in acres)
            </label>
            <input
              id="landArea"
              type="number"
              step="0.1"
              min="0"
              value={landArea}
              onChange={(e) => setLandArea(e.target.value)}
              placeholder="2.5"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Primary Crop */}
          <div>
            <label htmlFor="primaryCrop" className="block text-sm font-medium text-gray-700 mb-2">
              Primary Crop
            </label>
            <select
              id="primaryCrop"
              value={primaryCrop}
              onChange={(e) => setPrimaryCrop(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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

          {/* Language */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Language
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Complete Onboarding'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
