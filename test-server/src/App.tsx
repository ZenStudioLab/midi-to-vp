import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  LinearProgress,
  styled
} from '@mui/material';
import { analyzeVpNotation, convertMidiToVp, getDifficultyPreset, scoreConversionQuality } from '@zen/midi-to-vp/browser';
import type { AnalysisResult, ConversionResult, DifficultyLevel, ScoringAssessment, VpNotationMode } from '@zen/midi-to-vp/browser';
import { useState } from 'react';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const [scoring, setScoring] = useState<ScoringAssessment | null>(null);
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('Adept');

  // Conversion options
  const [notationMode, setNotationMode] = useState<VpNotationMode>('extended');
  const [slotsPerQuarter, setSlotsPerQuarter] = useState(4);
  const [includePercussion, setIncludePercussion] = useState(false);
  const [dedupe, setDedupe] = useState(true);
  const [simplifyChords, setSimplifyChords] = useState(true);
  const [maxChordSize, setMaxChordSize] = useState(3);

  const applyDifficultyPreset = (level: DifficultyLevel) => {
    const preset = getDifficultyPreset(level);
    setDifficultyLevel(level);
    setNotationMode(preset.notationMode ?? 'extended');
    setSlotsPerQuarter(preset.quantization?.slotsPerQuarter ?? 4);
    setDedupe(preset.dedupe ?? true);
    setSimplifyChords(preset.simplifyChords ?? true);
    setMaxChordSize(preset.maxChordSize ?? 3);
  };

  const analyzeSelectedFile = async (selectedFile: File) => {
    setAnalyzing(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      const preview = convertMidiToVp(uint8Array, {
        notationMode: 'standard',
        quantization: { slotsPerQuarter: 4 }
      });
      const nextAnalysis = analyzeVpNotation(preview.notation.selected);
      setAnalysis(nextAnalysis);
      setScoring(scoreConversionQuality(preview.metadata.qualitySignals));
      applyDifficultyPreset(nextAnalysis.recommendedLevel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setAnalysis(null);
      setScoring(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setScoring(null);
      void analyzeSelectedFile(selectedFile);
    }
  };

  const handleConvert = async () => {
    if (!file) {
      setError('Please select a MIDI file first');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      const conversionResult = convertMidiToVp(uint8Array, {
        notationMode,
        quantization: { slotsPerQuarter },
        includePercussion,
        dedupe,
        simplifyChords,
        maxChordSize,
      });

      setAnalysis(analyzeVpNotation(conversionResult.notation.selected));
      setScoring(scoreConversionQuality(conversionResult.metadata.qualitySignals));
      setResult(conversionResult);
      setTabValue(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
      setScoring(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50">
      <Container maxWidth="lg" className="py-8">
        <Box className="text-center mb-8">
          <MusicNoteIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h3" component="h1" gutterBottom className="font-bold">
            MIDI to Virtual Piano Converter
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Convert MIDI files to Virtual Piano notation (Standard and Extended modes)
          </Typography>
        </Box>

        <Stack spacing={4}>
          {/* Upload Section */}
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                1. Upload MIDI File
              </Typography>
              <Stack spacing={2} alignItems="center">
                <Button
                  component="label"
                  variant="contained"
                  startIcon={<CloudUploadIcon />}
                  size="large"
                >
                  Choose MIDI File
                  <VisuallyHiddenInput
                    type="file"
                    accept=".mid,.midi"
                    data-testid="midi-file-input"
                    onChange={handleFileChange}
                  />
                </Button>
                {file && (
                  <Chip
                    label={`Selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`}
                    color="primary"
                    variant="outlined"
                  />
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Options Section */}
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                2. Conversion Options
              </Typography>
              <Stack spacing={3}>
                <Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormControl fullWidth>
                    <InputLabel>Difficulty Profile</InputLabel>
                    <Select
                      data-testid="difficulty-level-select"
                      value={difficultyLevel}
                      label="Difficulty Profile"
                      onChange={(e) => applyDifficultyPreset(e.target.value as DifficultyLevel)}
                    >
                      <MenuItem value="Novice">Novice</MenuItem>
                      <MenuItem value="Apprentice">Apprentice</MenuItem>
                      <MenuItem value="Adept">Adept</MenuItem>
                      <MenuItem value="Master">Master</MenuItem>
                      <MenuItem value="Guru">Guru</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth>
                    <InputLabel>Notation Mode</InputLabel>
                    <Select
                      data-testid="notation-mode-select"
                      value={notationMode}
                      label="Notation Mode"
                      onChange={(e) => setNotationMode(e.target.value as VpNotationMode)}
                    >
                      <MenuItem value="extended">Extended (Full Range)</MenuItem>
                      <MenuItem value="standard">Standard (Compact)</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    type="number"
                    label="Slots Per Quarter Note"
                    value={slotsPerQuarter}
                    onChange={(e) => setSlotsPerQuarter(Number(e.target.value))}
                    inputProps={{ min: 1, max: 16, 'data-testid': 'slots-per-quarter-input' }}
                    fullWidth
                  />

                  <TextField
                    type="number"
                    label="Max Chord Size"
                    value={maxChordSize}
                    onChange={(e) => setMaxChordSize(Number(e.target.value))}
                    inputProps={{ min: 1, max: 10, 'data-testid': 'max-chord-size-input' }}
                    fullWidth
                  />
                </Box>

                <Divider />

                <Box className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={includePercussion}
                        onChange={(e) => setIncludePercussion(e.target.checked)}
                      />
                    }
                    label="Include Percussion"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        data-testid="dedupe-switch"
                        checked={dedupe}
                        onChange={(e) => setDedupe(e.target.checked)}
                        inputProps={{ 'data-testid': 'dedupe-switch-input' }}
                      />
                    }
                    label="Dedupe Notes"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={simplifyChords}
                        onChange={(e) => setSimplifyChords(e.target.checked)}
                      />
                    }
                    label="Simplify Chords"
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {(analyzing || analysis) && (
            <Card elevation={3} data-testid="analysis-panel">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Analysis
                </Typography>
                {analyzing && <LinearProgress />}
                {analysis && (
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Recommended Profile
                      </Typography>
                      <Typography variant="h6" data-testid="analysis-recommended-level">
                        {analysis.recommendedLevel}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Overall Score
                      </Typography>
                      <Typography variant="h6" data-testid="analysis-overall-score">
                        {analysis.overallScore}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Note Density ({analysis.noteDensity})
                      </Typography>
                      <LinearProgress variant="determinate" value={analysis.noteDensity} />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Chord Complexity ({analysis.chordComplexity})
                      </Typography>
                      <LinearProgress variant="determinate" value={analysis.chordComplexity} />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Rhythmic Complexity ({analysis.rhythmicComplexity})
                      </Typography>
                      <LinearProgress variant="determinate" value={analysis.rhythmicComplexity} />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Range Score ({analysis.rangeScore})
                      </Typography>
                      <LinearProgress variant="determinate" value={analysis.rangeScore} />
                    </Box>
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quality Score Panel */}
          {scoring && (
            <Card elevation={3} data-testid="quality-score-panel">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Conversion Quality
                </Typography>
                <Stack spacing={2}>
                  {/* Score badge */}
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Score
                    </Typography>
                    <Typography
                      variant="h4"
                      data-testid="quality-score-value"
                      sx={{
                        color:
                          scoring.score >= 0.75
                            ? 'success.main'
                            : scoring.score >= 0.5
                            ? 'warning.main'
                            : 'error.main',
                      }}
                    >
                      {(scoring.score * 100).toFixed(1)}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={scoring.score * 100}
                      sx={{
                        mt: 0.5,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor:
                            scoring.score >= 0.75
                              ? 'success.main'
                              : scoring.score >= 0.5
                              ? 'warning.main'
                              : 'error.main',
                        },
                      }}
                    />
                  </Box>

                  {/* Rubric version */}
                  <Box>
                    <Chip label={`Rubric: ${scoring.rubricVersion}`} size="small" variant="outlined" />
                  </Box>

                  {/* Signal progress bars */}
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Signals
                    </Typography>
                    <Stack spacing={1}>
                      {[
                        { label: 'In-Range Ratio', value: scoring.signals.inRangeRatio },
                        { label: 'Chord Complexity', value: scoring.signals.chordComplexity },
                        { label: 'Note Density', value: scoring.signals.noteDensity },
                        { label: 'Timing Consistency', value: scoring.signals.timingConsistency },
                      ].map(({ label, value }) => (
                        <Box key={label}>
                          <Typography variant="caption" color="text.secondary">
                            {label} ({(value * 100).toFixed(1)})
                          </Typography>
                          <LinearProgress variant="determinate" value={value * 100} />
                        </Box>
                      ))}
                    </Stack>
                  </Box>

                  {/* Reason code chips */}
                  {scoring.reasons.length > 0 && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Reason Codes
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {scoring.reasons.map((code) => (
                          <Chip
                            key={code}
                            label={code}
                            size="small"
                            color={
                              code.startsWith('FATAL_') || code.startsWith('INPUT_LIMIT_EXCEEDED_')
                                ? 'error'
                                : 'warning'
                            }
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Stats summary */}
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Stats
                    </Typography>
                    <Box className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div><strong>Total Notes:</strong> {scoring.stats.totalNotes}</div>
                      <div><strong>In-Range:</strong> {scoring.stats.inRangeNotes}</div>
                      <div><strong>Peak Chord:</strong> {scoring.stats.peakChordSize}</div>
                      <div><strong>Hard Chord Rate:</strong> {(scoring.stats.hardChordRate * 100).toFixed(1)}%</div>
                      <div><strong>Max Notes/s:</strong> {scoring.stats.maxNotesPerSecond.toFixed(1)}</div>
                      <div><strong>Duration:</strong> {scoring.stats.durationSeconds.toFixed(1)}s</div>
                      <div><strong>Grid Confidence:</strong> {(scoring.stats.gridConfidence * 100).toFixed(1)}%</div>
                    </Box>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Convert Button */}
          <Button
            variant="contained"
            size="large"
            data-testid="convert-button"
            onClick={handleConvert}
            disabled={loading}
            className="py-3"
          >
            {loading ? 'Converting...' : 'Convert to Virtual Piano Notation'}
          </Button>

          {/* Error Display */}
          {error && (
            <Alert data-testid="conversion-error" severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Results Section */}
          {result && (
            <Card elevation={3} data-testid="conversion-results">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  3. Conversion Results
                </Typography>

                {/* Metadata Summary */}
                <Paper variant="outlined" className="p-4 mb-4">
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Metadata
                  </Typography>
                  <Box className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <strong>Tempo:</strong> {result.metadata.tempoBpm} BPM
                    </div>
                    <div data-testid="metadata-total-slots">
                      <strong>Total Slots:</strong> {result.metadata.totalSlots}
                    </div>
                    <div>
                      <strong>Transpose:</strong> {result.transposeSemitones} semitones
                    </div>
                    <div>
                      <strong>Source Tracks:</strong> {result.metadata.sourceTrackCount}
                    </div>
                    <div data-testid="result-profile-level">
                      <strong>Profile:</strong> {difficultyLevel}
                    </div>
                    {analysis && (
                      <div>
                        <strong>Recommended:</strong> {analysis.recommendedLevel} ({analysis.confidence}% confidence)
                      </div>
                    )}
                  </Box>
                </Paper>

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <Alert severity="warning" className="mb-4">
                    <Typography variant="subtitle2" gutterBottom>
                      Warnings:
                    </Typography>
                    <ul className="ml-4">
                      {result.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </Alert>
                )}

                {/* Tabs for different outputs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
                    <Tab label="Notation" />
                    <Tab label="Timeline" />
                    <Tab label="Raw JSON" />
                  </Tabs>
                </Box>

                <TabPanel value={tabValue} index={0}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Extended Notation
                      </Typography>
                      <Paper variant="outlined" className="p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                        {result.notation.extended}
                      </Paper>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Standard Notation
                      </Typography>
                      <Paper variant="outlined" className="p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                        {result.notation.standard}
                      </Paper>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Selected Mode
                      </Typography>
                      <Paper variant="outlined" className="p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                        {result.notation.selected}
                      </Paper>
                    </Box>
                  </Stack>
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                  <Typography variant="subtitle2" gutterBottom>
                    Timeline ({result.timeline.length} slots)
                  </Typography>
                  <Paper variant="outlined" className="p-4 max-h-96 overflow-y-auto">
                    <pre className="text-xs">
                      {JSON.stringify(result.timeline.slice(0, 50), null, 2)}
                      {result.timeline.length > 50 && '\n... (truncated)'}
                    </pre>
                  </Paper>
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Full Conversion Result
                  </Typography>
                  <Paper variant="outlined" className="p-4 max-h-96 overflow-y-auto">
                    <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
                  </Paper>
                </TabPanel>

                {/* Download Buttons */}
                <Box className="mt-4 flex gap-2 flex-wrap">
                  <Button
                    variant="outlined"
                    onClick={() => {
                      const blob = new Blob([result.notation.extended], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'notation-extended.txt';
                      a.click();
                    }}
                  >
                    Download Extended Notation
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      const blob = new Blob([result.notation.standard], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'notation-standard.txt';
                      a.click();
                    }}
                  >
                    Download Standard Notation
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(result, null, 2)], {
                        type: 'application/json',
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'conversion-result.json';
                      a.click();
                    }}
                  >
                    Download JSON
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </Stack>

        {/* Footer */}
        <Box className="text-center mt-12 text-gray-500 text-sm">
          <Typography variant="body2">
            Powered by @zen/midi-to-vp v0.1.0
          </Typography>
        </Box>
      </Container>
    </div>
  );
}

export default App;
