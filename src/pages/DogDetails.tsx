import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type {
  Dog,
  MedicalHistoryEntry,
  MedicalRecord,
  MedicalRecordType,
  ReportPeriod,
  VitalHistory,
} from '@/types';
import {
  ArrowLeft,
  Thermometer,
  Heart,
  Activity,
  Battery,
  MapPin,
  Clock,
  AlertTriangle,
  FileText,
  Upload,
  Download,
  Syringe,
  Pill,
  File,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  X,
  Loader2,
  Plus,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveSensors } from '@/hooks/useLiveSensors';
import { usePersistLiveVitals } from '@/hooks/usePersistLiveVitals';
import { isReadingFresh, readingTimestampMs } from '@/lib/liveTelemetry';
import {
  createMedicalHistory,
  fetchDogById,
  fetchMedicalHistory,
  fetchMedicalRecords,
  fetchVitalHistory,
  saveHealthReport,
  uploadMedicalRecord,
} from '@/lib/api';
import { downloadBlob, generateHealthReportPdf, resolvePeriodRange } from '@/lib/pdfReport';

const DogDetails = () => {
  const { dogId } = useParams();
  const { toast } = useToast();
  const { user, userNGO } = useAuth();
  const { findReading, liveReadings } = useLiveSensors();

  const [dog, setDog] = useState<Dog | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyPeriod, setHistoryPeriod] = useState('7');
  const [vitalHistory, setVitalHistory] = useState<VitalHistory[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<MedicalRecordType>('vaccination');
  const [uploadNotes, setUploadNotes] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyForm, setHistoryForm] = useState({
    title: '',
    description: '',
    category: 'general' as MedicalHistoryEntry['category'],
    diagnosis: '',
  });
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('weekly');
  const [generating, setGenerating] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  usePersistLiveVitals({
    dogs: dog ? [dog] : [],
    ngoId: userNGO?.id,
    liveReadings,
    findReading,
    onDogsUpdated: updater => {
      setDog(prev => {
        if (!prev) return prev;
        return updater([prev])[0] ?? prev;
      });
    },
  });

  useEffect(() => {
    if (!dogId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchDogById(dogId),
      fetchMedicalRecords(dogId),
      fetchMedicalHistory(dogId),
    ])
      .then(([dogData, recs, hist]) => {
        if (cancelled) return;
        setDog(dogData);
        setRecords(recs);
        setMedicalHistory(hist);
      })
      .catch(err => {
        console.error(err);
        toast({ title: 'Failed to load dog', variant: 'destructive' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dogId]);

  useEffect(() => {
    if (!dogId) return;
    const loadHistory = () => {
      fetchVitalHistory(dogId, parseInt(historyPeriod, 10))
        .then(setVitalHistory)
        .catch(console.error);
    };
    loadHistory();
    const interval = setInterval(loadHistory, 10000);
    return () => clearInterval(interval);
  }, [dogId, historyPeriod]);

  useEffect(() => {
    if (!dogId || !Object.keys(liveReadings).length) return;
    const t = setTimeout(() => {
      fetchVitalHistory(dogId, parseInt(historyPeriod, 10))
        .then(setVitalHistory)
        .catch(console.error);
    }, 2000);
    return () => clearTimeout(t);
  }, [liveReadings, dogId, historyPeriod]);

  const reading = dog ? findReading(dog.deviceId, dog.id, dog.name) : null;
  const liveData = reading && isReadingFresh(reading)
    ? {
        temperature: Number(reading.bodyTempC ?? 0),
        heartRate: reading.bpm ?? 0,
        spo2: reading.spo2 ?? 0,
        activity: reading.activity || 'Resting',
        batteryLevel: null as number | null,
        location: { lat: reading.lat ?? 0, lng: reading.lon ?? 0 },
        timestamp: new Date(readingTimestampMs(reading) ?? Date.now()),
        isLive: true,
        alertActive: false,
        alertMessage: undefined as string | undefined,
      }
    : {
        temperature: 0,
        heartRate: 0,
        spo2: 0,
        activity: 'No signal',
        batteryLevel: null as number | null,
        location: { lat: 0, lng: 0 },
        timestamp: new Date(),
        isLive: false,
        alertActive: false,
        alertMessage: undefined as string | undefined,
      };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!dog) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 text-center">
          <p>Dog not found</p>
          <Button asChild className="mt-4">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const showRed =
    dog.hasAlert ||
    dog.status === 'critical' ||
    dog.status === 'warning' ||
    liveData.alertActive;

  const chartData = vitalHistory.map(v => ({
    time: format(v.timestamp, 'MMM dd HH:mm'),
    temperature: v.temperature,
    heartRate: v.heartRate,
  }));

  const getVitalTrend = (data: number[]) => {
    if (data.length < 2) return 'stable';
    const recent = data.slice(-10);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const last = recent[recent.length - 1];
    if (last > avg * 1.05) return 'up';
    if (last < avg * 0.95) return 'down';
    return 'stable';
  };

  const tempTrend = getVitalTrend(vitalHistory.map(v => v.temperature));
  const hrTrend = getVitalTrend(vitalHistory.map(v => v.heartRate));

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) setUploadedFiles(Array.from(e.dataTransfer.files));
  };

  const handleUploadRecord = async () => {
    if (!uploadedFiles.length || !userNGO?.id || !user?.id) return;
    setUploading(true);
    try {
      const record = await uploadMedicalRecord({
        dogId: dog.id,
        ngoId: userNGO.id,
        type: uploadType,
        title: uploadedFiles[0].name,
        notes: uploadNotes || notesRef.current?.value || '',
        file: uploadedFiles[0],
        uploadedBy: user.id,
      });
      setRecords(prev => [record, ...prev]);
      toast({ title: 'Record Uploaded!', description: `${uploadedFiles[0].name} has been saved.` });
      setUploadOpen(false);
      setUploadedFiles([]);
      setUploadNotes('');
    } catch (err: unknown) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAddHistory = async () => {
    if (!userNGO?.id || !user?.id || !historyForm.title) return;
    try {
      const entry = await createMedicalHistory({
        dogId: dog.id,
        ngoId: userNGO.id,
        category: historyForm.category,
        title: historyForm.title,
        description: historyForm.description,
        diagnosis: historyForm.diagnosis,
        createdBy: user.id,
      });
      setMedicalHistory(prev => [entry, ...prev]);
      setHistoryOpen(false);
      setHistoryForm({ title: '', description: '', category: 'general', diagnosis: '' });
      toast({ title: 'Medical history saved' });
    } catch (err: unknown) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateReport = async () => {
    if (!userNGO || !user) return;
    setGenerating(true);
    try {
      const { from, to } = resolvePeriodRange(reportPeriod);
      const vitals = await fetchVitalHistory(
        dog.id,
        Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000))
      ).catch(() => []);
      const filtered = vitals.filter(v => v.timestamp >= from && v.timestamp <= to);
      const blob = generateHealthReportPdf({
        dog,
        ngoName: userNGO.name,
        period: reportPeriod,
        from,
        to,
        vitals: filtered,
        records,
      });
      // Always download — no storage bucket required
      downloadBlob(blob, `${dog.name}-${reportPeriod}-health-report.pdf`);
      await saveHealthReport({
        dogId: dog.id,
        ngoId: userNGO.id,
        generatedBy: user.id,
        periodType: reportPeriod,
        periodStart: from.toISOString().slice(0, 10),
        periodEnd: to.toISOString().slice(0, 10),
        summary: { readings: filtered.length },
      }).catch(() => undefined);
      toast({ title: 'Report Generated!', description: 'Your PDF report has been downloaded.' });
    } catch (err: unknown) {
      toast({
        title: 'Report failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'vaccination':
        return <Syringe className="h-4 w-4" />;
      case 'prescription':
        return <Pill className="h-4 w-4" />;
      case 'report':
        return <FileText className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className={cn('md:col-span-1', showRed && 'border-destructive ring-2 ring-destructive/30')}>
            <CardContent className="p-0">
              <div className="relative">
                <img
                  src={dog.imageUrl}
                  alt={dog.name}
                  className="w-full h-64 object-cover rounded-t-lg"
                />
                {showRed && (
                  <div className="absolute top-4 right-4 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full animate-pulse flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white" />
                    <AlertTriangle className="h-4 w-4" /> Alert Active
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-2xl font-bold">{dog.name}</h1>
                  <StatusBadge status={dog.status} />
                </div>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Breed:</span> {dog.breed}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Age:</span> {dog.age || '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Weight:</span> {dog.weight || '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Device ID:</span> {dog.deviceId}
                  </p>
                </div>
                {showRed && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="text-destructive text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />{' '}
                      {liveData.alertMessage || dog.alertMessage || 'Unwell / alert condition'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Live Sensor Data
                <Badge variant="secondary" className="ml-auto">
                  <span
                    className={`h-2 w-2 rounded-full mr-2 ${
                      liveData.isLive ? 'bg-green-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {liveData.isLive ? 'Live' : 'Offline'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                  className={cn(
                    'p-4 rounded-lg',
                    liveData.temperature > 39.5 ? 'bg-destructive/10' : 'bg-muted'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer
                      className={cn(
                        'h-5 w-5',
                        liveData.temperature > 39.5 ? 'text-destructive' : 'text-orange-500'
                      )}
                    />
                    <span className="text-sm text-muted-foreground">Temperature</span>
                  </div>
                  <p
                    className={cn(
                      'text-2xl font-bold',
                      liveData.temperature > 39.5 && 'text-destructive'
                    )}
                  >
                    {liveData.temperature ? `${liveData.temperature}°C` : '—'}
                  </p>
                </div>
                <div
                  className={cn(
                    'p-4 rounded-lg',
                    liveData.heartRate > 130 ? 'bg-destructive/10' : 'bg-muted'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Heart
                      className={cn(
                        'h-5 w-5',
                        liveData.heartRate > 130 ? 'text-destructive' : 'text-red-500'
                      )}
                    />
                    <span className="text-sm text-muted-foreground">Heart Rate</span>
                  </div>
                  <p
                    className={cn(
                      'text-2xl font-bold',
                      liveData.heartRate > 130 && 'text-destructive'
                    )}
                  >
                    {liveData.heartRate ? `${liveData.heartRate} bpm` : '—'}
                  </p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-muted-foreground">Activity</span>
                  </div>
                  <p className="text-2xl font-bold">{liveData.activity}</p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-muted-foreground">SpO₂</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {liveData.spo2 ? `${liveData.spo2}%` : '—'}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {liveData.location.lat.toFixed(4)}, {liveData.location.lng.toFixed(4)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Last updated: {format(liveData.timestamp, 'HH:mm:ss')}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="history" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="history">Vital History</TabsTrigger>
            <TabsTrigger value="records">Medical Records</TabsTrigger>
            <TabsTrigger value="medical-history">Medical History</TabsTrigger>
            <TabsTrigger value="reports">Health Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <CardTitle>Vital History</CardTitle>
                  <Select value={historyPeriod} onValueChange={setHistoryPeriod}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Last 24 Hours</SelectItem>
                      <SelectItem value="7">Last 7 Days</SelectItem>
                      <SelectItem value="30">Last 30 Days</SelectItem>
                      <SelectItem value="90">Last 3 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {vitalHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">
                    No vital history yet. Live collar readings are saved automatically when
                    available.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <Thermometer className="h-5 w-5 text-orange-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Temperature Trend</p>
                          <div className="flex items-center gap-1">
                            {tempTrend === 'up' && <TrendingUp className="h-4 w-4 text-destructive" />}
                            {tempTrend === 'down' && (
                              <TrendingDown className="h-4 w-4 text-green-500" />
                            )}
                            {tempTrend === 'stable' && (
                              <Minus className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium capitalize">{tempTrend}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <Heart className="h-5 w-5 text-red-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Heart Rate Trend</p>
                          <div className="flex items-center gap-1">
                            {hrTrend === 'up' && <TrendingUp className="h-4 w-4 text-destructive" />}
                            {hrTrend === 'down' && (
                              <TrendingDown className="h-4 w-4 text-green-500" />
                            )}
                            {hrTrend === 'stable' && (
                              <Minus className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium capitalize">{hrTrend}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mb-8">
                      <h4 className="text-sm font-medium mb-4">Temperature History</h4>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="time" fontSize={10} tickLine={false} />
                            <YAxis domain={['auto', 'auto']} fontSize={10} tickLine={false} />
                            <Tooltip />
                            <Area
                              type="monotone"
                              dataKey="temperature"
                              stroke="hsl(var(--primary))"
                              fill="hsl(var(--primary) / 0.2)"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-4">Heart Rate History</h4>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="time" fontSize={10} tickLine={false} />
                            <YAxis domain={[40, 160]} fontSize={10} tickLine={false} />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="heartRate"
                              stroke="#ef4444"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="records" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Medical Records</CardTitle>
                  <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Upload className="mr-2 h-4 w-4" /> Upload Record
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Upload Medical Record</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Record Type</Label>
                          <Select
                            value={uploadType}
                            onValueChange={v => setUploadType(v as MedicalRecordType)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vaccination">Vaccination Card</SelectItem>
                              <SelectItem value="prescription">Prescription</SelectItem>
                              <SelectItem value="report">Lab Report</SelectItem>
                              <SelectItem value="other">Other Document</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div
                          className={cn(
                            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                            dragActive
                              ? 'border-primary bg-primary/5'
                              : 'border-muted-foreground/25'
                          )}
                          onDragEnter={handleDrag}
                          onDragLeave={handleDrag}
                          onDragOver={handleDrag}
                          onDrop={handleDrop}
                        >
                          <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                          <label htmlFor="file-upload">
                            <Button variant="secondary" size="sm" asChild>
                              <span className="cursor-pointer">Browse Files</span>
                            </Button>
                            <input
                              id="file-upload"
                              type="file"
                              className="hidden"
                              onChange={e =>
                                e.target.files && setUploadedFiles(Array.from(e.target.files))
                              }
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            />
                          </label>
                        </div>
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                            <File className="h-4 w-4" />
                            <span className="text-sm flex-1 truncate">{file.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                setUploadedFiles(prev => prev.filter((_, i) => i !== index))
                              }
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <div>
                          <Label>Notes (Optional)</Label>
                          <Textarea
                            ref={notesRef}
                            value={uploadNotes}
                            onChange={e => setUploadNotes(e.target.value)}
                            placeholder="Add any additional notes..."
                            rows={3}
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={handleUploadRecord}
                          disabled={!uploadedFiles.length || uploading}
                        >
                          {uploading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          Upload Record
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {records.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No medical records yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {records.map(record => (
                      <div
                        key={record.id}
                        className="flex items-center gap-4 p-4 bg-muted rounded-lg"
                      >
                        <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                          {getRecordIcon(record.type)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{record.title}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-3 w-3" /> {format(record.date, 'PPP')}
                          </p>
                        </div>
                        <Badge variant="secondary" className="capitalize">
                          {record.type}
                        </Badge>
                        {record.fileUrl && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={record.fileUrl} target="_blank" rel="noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="medical-history" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Previous Medical History</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Used as knowledge for the AI dog health assistant
                    </p>
                  </div>
                  <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Entry
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Medical History</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Title</Label>
                          <Input
                            value={historyForm.title}
                            onChange={e =>
                              setHistoryForm({ ...historyForm, title: e.target.value })
                            }
                            placeholder="e.g., Skin infection treatment"
                          />
                        </div>
                        <div>
                          <Label>Category</Label>
                          <Select
                            value={historyForm.category}
                            onValueChange={v =>
                              setHistoryForm({
                                ...historyForm,
                                category: v as MedicalHistoryEntry['category'],
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General</SelectItem>
                              <SelectItem value="diagnosis">Diagnosis</SelectItem>
                              <SelectItem value="treatment">Treatment</SelectItem>
                              <SelectItem value="surgery">Surgery</SelectItem>
                              <SelectItem value="allergy">Allergy</SelectItem>
                              <SelectItem value="chronic">Chronic</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Diagnosis</Label>
                          <Input
                            value={historyForm.diagnosis}
                            onChange={e =>
                              setHistoryForm({ ...historyForm, diagnosis: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea
                            rows={4}
                            value={historyForm.description}
                            onChange={e =>
                              setHistoryForm({ ...historyForm, description: e.target.value })
                            }
                          />
                        </div>
                        <Button className="w-full" onClick={handleAddHistory}>
                          Save
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {medicalHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">
                    No medical history entries yet.
                  </p>
                ) : (
                  medicalHistory.map(entry => (
                    <div key={entry.id} className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="capitalize">
                          {entry.category}
                        </Badge>
                        <span className="font-medium">{entry.title}</span>
                      </div>
                      {entry.diagnosis && (
                        <p className="text-sm text-muted-foreground">Diagnosis: {entry.diagnosis}</p>
                      )}
                      <p className="text-sm mt-1">{entry.description}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate Health Report</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as ReportPeriod[]).map(p => (
                    <Button
                      key={p}
                      variant={reportPeriod === p ? 'default' : 'outline'}
                      className="h-20 flex-col capitalize"
                      onClick={() => setReportPeriod(p)}
                    >
                      <FileText className="h-5 w-5 mb-2" />
                      {p}
                    </Button>
                  ))}
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleGenerateReport}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Generate PDF Report
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default DogDetails;
