import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { dogSpecies, type Dog } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveSensors } from '@/hooks/useLiveSensors';
import { createDog, deleteDog, fetchDogsByNgo } from '@/lib/api';
import { Plus, Search, Trash2, Loader2, AlertTriangle, Radio } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const MyDogs = () => {
  const { user, userNGO } = useAuth();
  const { toast } = useToast();
  const { availableCollarIds, liveLoading, findReading } = useLiveSensors();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    species: '',
    customSpecies: '',
    deviceId: '',
    age: '',
    weight: '',
  });

  const usedDeviceIds = new Set(dogs.map(d => d.deviceId));
  const selectedReading = formData.deviceId ? findReading(formData.deviceId) : null;

  const loadDogs = async () => {
    if (!userNGO?.id) {
      setDogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchDogsByNgo(userNGO.id);
      setDogs(data);
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to load dogs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDogs();
  }, [userNGO?.id]);

  const filtered = dogs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  const handleAddDog = async () => {
    if (!userNGO?.id || !user?.id) {
      toast({ title: 'Create an NGO first', variant: 'destructive' });
      return;
    }
    if (!formData.name || !formData.deviceId || !formData.species) {
      toast({ title: 'Name, breed, and collar ID are required', variant: 'destructive' });
      return;
    }
    if (usedDeviceIds.has(formData.deviceId)) {
      toast({
        title: 'Collar already linked',
        description: 'This collar ID is already assigned to another dog.',
        variant: 'destructive',
      });
      return;
    }

    const species =
      formData.species === 'Other' ? formData.customSpecies || 'Other' : formData.species;

    setSaving(true);
    try {
      const dog = await createDog({
        ngoId: userNGO.id,
        name: formData.name,
        species,
        breed: species,
        deviceId: formData.deviceId.trim(),
        age: formData.age,
        weight: formData.weight,
        createdBy: user.id,
      });
      setDogs(prev => [dog, ...prev]);
      toast({
        title: 'Dog Added!',
        description: `${formData.name} linked to collar ${formData.deviceId}. Live vitals and history will start saving.`,
      });
      setAddOpen(false);
      setFormData({ name: '', species: '', customSpecies: '', deviceId: '', age: '', weight: '' });
    } catch (err: unknown) {
      toast({
        title: 'Could not add dog',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dog: Dog) => {
    if (!confirm(`Remove ${dog.name}?`)) return;
    try {
      await deleteDog(dog.id);
      setDogs(prev => prev.filter(d => d.id !== dog.id));
      toast({ title: 'Dog removed' });
    } catch (err: unknown) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Dogs</h1>
            <p className="text-muted-foreground">Manage all dogs under your NGO</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add New Dog
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Dog</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Dog Name *</Label>
                  <Input
                    placeholder="e.g., Bruno"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Species/Breed *</Label>
                  <Select
                    value={formData.species}
                    onValueChange={v => setFormData({ ...formData, species: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select breed" />
                    </SelectTrigger>
                    <SelectContent>
                      {dogSpecies.map(s => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.species === 'Other' && (
                  <div>
                    <Label>Specify Breed</Label>
                    <Input
                      placeholder="Enter breed name"
                      value={formData.customSpecies}
                      onChange={e => setFormData({ ...formData, customSpecies: e.target.value })}
                    />
                  </div>
                )}

                <div>
                  <Label>Device/Collar ID *</Label>
                  <Select
                    value={formData.deviceId || undefined}
                    onValueChange={v => setFormData({ ...formData, deviceId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          liveLoading
                            ? 'Loading collars…'
                            : availableCollarIds.length
                              ? 'Select a collar ID'
                              : 'No collars online'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCollarIds.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          {liveLoading
                            ? 'Connecting to live collars…'
                            : 'No collar IDs found under live telemetry'}
                        </div>
                      ) : (
                        availableCollarIds.map(id => {
                          const reading = findReading(id);
                          const alreadyUsed = usedDeviceIds.has(id);
                          return (
                            <SelectItem key={id} value={id} disabled={alreadyUsed}>
                              <span className="flex items-center gap-2">
                                <Radio
                                  className={`h-3.5 w-3.5 ${
                                    alreadyUsed ? 'text-muted-foreground' : 'text-emerald-500'
                                  }`}
                                />
                                <span className="font-mono">{id}</span>
                                {alreadyUsed && (
                                  <span className="text-xs text-muted-foreground">(in use)</span>
                                )}
                                {!alreadyUsed && reading?.bodyTempC != null && (
                                  <span className="text-xs text-muted-foreground">
                                    · {reading.bodyTempC}°C · {reading.bpm ?? 0} bpm
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select from live collar IDs. History will be tracked for this device.
                  </p>
                  {selectedReading && (
                    <div className="mt-2 rounded-md border bg-muted/50 p-3 text-xs space-y-1">
                      <p className="font-medium flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live preview · {formData.deviceId}
                      </p>
                      <p>Temp: {selectedReading.bodyTempC ?? '—'}°C</p>
                      <p>Heart rate: {selectedReading.bpm ?? '—'} bpm</p>
                      <p>SpO₂: {selectedReading.spo2 ?? '—'}%</p>
                      <p>
                        GPS: {selectedReading.lat ?? '—'}, {selectedReading.lon ?? '—'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Age</Label>
                    <Input
                      placeholder="e.g., 3 years"
                      value={formData.age}
                      onChange={e => setFormData({ ...formData, age: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Weight</Label>
                    <Input
                      placeholder="e.g., 25 kg"
                      value={formData.weight}
                      onChange={e => setFormData({ ...formData, weight: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleAddDog}
                  disabled={saving || !formData.deviceId}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Dog
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

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
          <p className="text-center text-muted-foreground py-16">No dogs found. Add your first dog.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(dog => {
              const showRed = dog.hasAlert || dog.status === 'critical' || dog.status === 'warning';
              return (
                <Card
                  key={dog.id}
                  className={showRed ? 'border-destructive ring-2 ring-destructive/20' : ''}
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
                          <AlertTriangle className="h-3 w-3" /> Alert
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">{dog.name}</h3>
                          <p className="text-sm text-muted-foreground">{dog.breed}</p>
                        </div>
                        <StatusBadge status={dog.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">Device: {dog.deviceId}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <Link to={`/dog/${dog.id}`}>View Details</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(dog)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MyDogs;
