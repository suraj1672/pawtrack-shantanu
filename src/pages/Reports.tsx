import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Dog, ReportPeriod } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchDogsByNgo,
  fetchMedicalRecords,
  fetchVitalHistory,
  saveHealthReport,
} from '@/lib/api';
import { downloadBlob, generateHealthReportPdf, resolvePeriodRange } from '@/lib/pdfReport';
import { FileText, Download, CalendarIcon, Dog as DogIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const Reports = () => {
  const { user, userNGO } = useAuth();
  const { toast } = useToast();
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedDog, setSelectedDog] = useState('');
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  useEffect(() => {
    if (!userNGO?.id) {
      setLoading(false);
      return;
    }
    fetchDogsByNgo(userNGO.id)
      .then(setDogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userNGO?.id]);

  const handleGenerate = async () => {
    if (!selectedDog || !userNGO || !user) return;
    const dog = dogs.find(d => d.id === selectedDog);
    if (!dog) return;

    setGenerating(true);
    try {
      const { from, to } = resolvePeriodRange(period, dateRange.from, dateRange.to);
      const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
      const [vitals, records] = await Promise.all([
        fetchVitalHistory(dog.id, days).catch(() => []),
        fetchMedicalRecords(dog.id).catch(() => []),
      ]);
      const filtered = vitals.filter(v => v.timestamp >= from && v.timestamp <= to);
      const blob = generateHealthReportPdf({
        dog,
        ngoName: userNGO.name,
        period,
        from,
        to,
        vitals: filtered,
        records,
      });
      // Always download PDF for any logged-in user (no storage bucket required)
      downloadBlob(blob, `${dog.name}-${period}-health-report.pdf`);

      // Optional metadata save — never block the download
      await saveHealthReport({
        dogId: dog.id,
        ngoId: userNGO.id,
        generatedBy: user.id,
        periodType: period,
        periodStart: from.toISOString().slice(0, 10),
        periodEnd: to.toISOString().slice(0, 10),
        summary: { readings: filtered.length, records: records.length },
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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <FileText className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold">Health Reports</h1>
          <p className="text-muted-foreground">
            Generate comprehensive health reports in PDF format
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Dog</label>
                  <Select value={selectedDog} onValueChange={setSelectedDog}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a dog" />
                    </SelectTrigger>
                    <SelectContent>
                      {dogs.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          <div className="flex items-center gap-2">
                            <DogIcon className="h-4 w-4" /> {d.name} - {d.breed}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Report Period</label>
                  <div className="flex flex-wrap gap-2">
                    {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as ReportPeriod[]).map(p => (
                      <Button
                        key={p}
                        variant={period === p ? 'default' : 'outline'}
                        size="sm"
                        className="capitalize"
                        onClick={() => setPeriod(p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>

                {period === 'custom' && (
                  <div className="flex gap-4 flex-wrap">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[200px] justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.from ? format(dateRange.from, 'PPP') : 'From date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={d => setDateRange({ ...dateRange, from: d })}
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[200px] justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.to ? format(dateRange.to, 'PPP') : 'To date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={d => setDateRange({ ...dateRange, to: d })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Report will include:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Temperature trends and alerts</li>
                    <li>• Heart rate analysis</li>
                    <li>• Activity patterns</li>
                    <li>• Medical records summary</li>
                    <li>• Health recommendations</li>
                  </ul>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleGenerate}
                  disabled={!selectedDog || generating}
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Generate PDF Report
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Medical Records Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Upload vaccination cards, prescriptions, and documents from each dog's detail page.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {dogs.slice(0, 4).map(dog => (
                <Button key={dog.id} variant="outline" className="h-24 flex-col" asChild>
                  <Link to={`/dog/${dog.id}`}>
                    <FileText className="h-6 w-6 mb-2" />
                    <span className="text-xs">{dog.name}</span>
                  </Link>
                </Button>
              ))}
              {!dogs.length && (
                <p className="text-sm text-muted-foreground col-span-full">
                  Add dogs first to manage their records.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Reports;
