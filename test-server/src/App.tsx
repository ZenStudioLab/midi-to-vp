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
  styled
} from '@mui/material';
import { convertMidiToVp, getDifficultyPreset } from '@zen/midi-to-vp';
import type { ConversionResult, DifficultyLevel, VpNotationMode } from '@zen/midi-to-vp';
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
  const [tabValue, setTabValue] = useState(0);

  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('hard');

  // Conversion options
  const [notationMode, setNotationMode] = useState<VpNotationMode>('extended');
  const [slotsPerQuarter, setSlotsPerQuarter] = useState(4);
  const [includePercussion, setIncludePercussion] = useState(false);
  const [dedupe, setDedupe] = useState(true);
  const [simplifyChords, setSimplifyChords] = useState(true);
  const [maxChordSize, setMaxChordSize] = useState(4);

  const applyDifficultyPreset = (level: DifficultyLevel) => {
    const preset = getDifficultyPreset(level);
    setDifficultyLevel(level);
    setNotationMode(preset.notationMode ?? 'extended');
    setSlotsPerQuarter(preset.quantization?.slotsPerQuarter ?? 4);
    setDedupe(preset.dedupe ?? true);
    setSimplifyChords(preset.simplifyChords ?? true);
    setMaxChordSize(preset.maxChordSize ?? 4);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
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

      setResult(conversionResult);
      setTabValue(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
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
            Convert MIDI files to Virtual Piano notation (Extended, Standard, and Zen modes)
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
                      <MenuItem value="easy">Easy</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="hard">Hard</MenuItem>
                      <MenuItem value="hardcore">Hardcore</MenuItem>
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
                      <MenuItem value="zen">Zen (36-Key Compact)</MenuItem>
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
                        Zen Notation
                      </Typography>
                      <Paper variant="outlined" className="p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                        {result.notation.zen}
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
                      const blob = new Blob([result.notation.zen], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'notation-zen.txt';
                      a.click();
                    }}
                  >
                    Download Zen Notation
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
