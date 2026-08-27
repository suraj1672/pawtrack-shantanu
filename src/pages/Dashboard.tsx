import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Dog } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveSensors } from '@/hooks/useLiveSensors';
import { usePersistLiveVitals } from '@/hooks/usePersistLiveVitals';
import { fetchDogsByNgo } from '@/lib/api';
import { Dog as DogIcon, Activity, Thermometer, Heart, AlertTriangle, Search, Bell, Plus, Loader2 } from 'lucide-react';
import { ref, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import StatusBadge from '@/components/StatusBadge';

interface DogVitals {
  temperature: number;
  heartRate: number;
  activity: string;
  location: { lat: number; lng: number };
  batteryLevel: number | null;
  speedKmph?: number;
  spo2?: number;
  sats?: number;
  isLive: boolean;
  sourceLabel: string;
}

const formatNumber = (value?: number, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';

const Dashboard = () => {
  const { userNGO } = useAuth();
  const [search, setSearch] = useState('');
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);
  const { liveReadings, liveLoading, findReading, liveCount } = useLiveSensors();
  const onDogsUpdated = useCallback((updater: (prev: Dog[]) => Dog[]) => {
    setDogs(updater);
  }, []);

  usePersistLiveVitals({
    dogs,
    ngoId: userNGO?.id,
    liveReadings,
    findReading,
    onDogsUpdated,
  });

  useEffect(() => {
    if (!userNGO?.id) {
      setDogs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchDogsByNgo(userNGO.id)
      .then(data => {
        if (!cancelled) setDogs(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userNGO?.id]);

  const enrichedDogs: Dog[] = dogs.map(dog => {
    const reading = findReading(dog.deviceId, dog.id, dog.name);
    if (!reading) return dog;
    const temperature = Number(reading.bodyTempC ?? 0);
    const heartRate = reading.bpm ?? 0;
    const critical = temperature > 39.5 || heartRate > 140;
    const warning = temperature > 39.2 || heartRate > 130 || (temperature > 0 && temperature < 36);
    if (critical || warning) {
      return {
        ...dog,
        status: critical ? 'critical' : 'warning',
        hasAlert: true,
        alertMessage:
          dog.alertMessage ||
          (temperature > 0 && temperature < 36
            ? `Possible low body temperature - ${temperature.toFixed(1)}°C`
            : temperature > 39.2
              ? `High temperature detected - ${temperature.toFixed(1)}°C`
              : `Elevated heart rate - ${heartRate} bpm`),
        lastSeen: new Date(),
      };
    }
    return { ...dog, status: 'online', lastSeen: new Date() };
  });

  const filtered = enrichedDogs.filter(dog =>
    dog.name.toLowerCase().includes(search.toLowerCase())
  );

  const alertDogs = enrichedDogs.filter(d => d.hasAlert || d.status === 'critical' || d.status === 'warning');
  const onlineDogs = enrichedDogs.filter(d => d.status === 'online').length;
  const criticalDogs = enrichedDogs.filter(d => d.status === 'critical').length;

  const getDogVitals = (dog: Dog): DogVitals => {
    const reading = findReading(dog.deviceId, dog.id, dog.name);
    if (reading) {
      return {
        temperature: Number(reading.bodyTempC ?? 0),
        heartRate: reading.bpm ?? 0,
        activity: reading.activity || 'Resting',
        location: { lat: reading.lat ?? 0, lng: reading.lon ?? 0 },
        batteryLevel: null,
        spo2: reading.spo2,
        isLive: true,
        sourceLabel: 'Live collar',
      };
    }

    return {
      temperature: 0,
      heartRate: 0,
      activity: 'No signal',
      location: { lat: 0, lng: 0 },
      batteryLevel: null,
      isLive: false,
      sourceLabel: 'Waiting for collar',
    };
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {userNGO?.name || 'Your NGO'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link to="/my-dogs">
                <Plus className="mr-2 h-4 w-4" /> Add New Dog
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const deviceId = window.prompt('Device ID (e.g. DOG_001)');
                if (!deviceId) return;
                const temp = parseFloat(window.prompt('Temperature (°C)', '38.5') || '38.5');
                const hr = parseInt(window.prompt('Heart rate (bpm)', '120') || '120');
                const lat = parseFloat(window.prompt('Latitude', '0') || '0');
                const lon = parseFloat(window.prompt('Longitude', '0') || '0');
                const spo2 = parseFloat(window.prompt('spO2', '98') || '98');
                const payload = {
                  temperature: Number.isFinite(temp) ? temp : 0,
                  heartRate: Number.isFinite(hr) ? hr : 0,
                  latitude: Number.isFinite(lat) ? lat : 0,
                  longitude: Number.isFinite(lon) ? lon : 0,
                  spO2: Number.isFinite(spo2) ? spo2 : 0,
                };
                try {
                  await set(ref(database, `pawtect/${deviceId}`), payload);
                  window.alert('Test reading sent to ' + deviceId);
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error('Failed to send test reading', err);
                  window.alert('Failed to send test reading: ' + String(err));
                }
              }}
            >
              Send test reading
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <DogIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{enrichedDogs.length}</p>
                <p className="text-sm text-muted-foreground">Total Dogs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{onlineDogs}</p>
                <p className="text-sm text-muted-foreground">Online</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{criticalDogs}</p>
                <p className="text-sm text-muted-foreground">Critical</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Bell className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alertDogs.length}</p>
                <p className="text-sm text-muted-foreground">Alerts</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-6">
          <span
            className={`h-2 w-2 rounded-full transition-colors ${
              liveLoading ? 'bg-amber-400 animate-pulse' : liveCount ? 'bg-emerald-500' : 'bg-slate-500'
            }`}
          />
          <p>
            {liveLoading
              ? 'Connecting to live collars…'
              : liveCount
                ? `${liveCount} live collar reading${liveCount === 1 ? '' : 's'}`
                : 'No live collar readings yet'}
          </p>
        </div>

        {alertDogs.length > 0 && (
          <Card className="mb-8 border-destructive bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alertDogs.map(dog => (
                  <Link
                    key={dog.id}
                    to={`/dog/${dog.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg bg-background border border-destructive/30 hover:bg-muted transition-colors"
                  >
                    <div className="relative">
                      <img
                        src={dog.imageUrl}
                        alt={dog.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{dog.name}</p>
                      <p className="text-sm text-destructive">
                        {dog.alertMessage || 'Unwell / alert condition'}
                      </p>
                    </div>
                    <Button variant="destructive" size="sm">
                      View Details
                    </Button>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search dogs..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <DogIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No dogs yet</p>
              <p className="text-sm mb-4">Add a dog and link its collar device ID to see live vitals.</p>
              <Button asChild>
                <Link to="/my-dogs">Add New Dog</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(dog => {
              const vitals = getDogVitals(dog);
              const showRed = dog.hasAlert || dog.status === 'critical' || dog.status === 'warning';
              return (
                <Link key={dog.id} to={`/dog/${dog.id}`}>
                  <Card
                    className={`hover:shadow-lg transition-shadow cursor-pointer ${
                      showRed ? 'border-destructive ring-2 ring-destructive/30' : ''
                    }`}
                  >
                    <CardContent className="p-0">
                      <div className="relative">
                        <img
                          src={dog.imageUrl}
                          alt={dog.name}
                          className="w-full h-40 object-cover rounded-t-lg"
                        />
                        {showRed && (
                          <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded animate-pulse flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-white" />
                            <AlertTriangle className="h-3 w-3" /> Alert
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2">
                          <StatusBadge status={dog.status} />
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{dog.name}</h3>
                            <p className="text-sm text-muted-foreground">{dog.breed}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {dog.deviceId}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-muted rounded p-2">
                            <Thermometer className="h-4 w-4 mx-auto mb-1 text-orange-500" />
                            <p className="text-xs font-medium">{formatNumber(vitals.temperature)}°C</p>
                            <p className="text-[10px] text-muted-foreground">Temp</p>
                          </div>
                          <div className="bg-muted rounded p-2">
                            <Heart className="h-4 w-4 mx-auto mb-1 text-red-500" />
                            <p className="text-xs font-medium">{formatNumber(vitals.heartRate, 0)} bpm</p>
                            <p className="text-[10px] text-muted-foreground">Heart</p>
                          </div>
                          <div className="bg-muted rounded p-2">
                            <Activity className="h-4 w-4 mx-auto mb-1 text-green-500" />
                            <p className="text-xs font-medium">{vitals.activity}</p>
                            <p className="text-[10px] text-muted-foreground">Activity</p>
                          </div>
                        </div>
                        <div className="mt-4 text-xs text-muted-foreground space-y-1">
                          <p>
                            Lat {formatNumber(vitals.location.lat, 3)} · Lon{' '}
                            {formatNumber(vitals.location.lng, 3)}
                          </p>
                          <p
                            className={`text-[10px] uppercase tracking-widest ${
                              vitals.isLive ? 'text-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {vitals.sourceLabel}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
