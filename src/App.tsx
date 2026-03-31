import { useState, useEffect, useMemo } from 'react';
import {
    verifySolution,
    parseCoefficientMatrix,
    toCoords,
    evaluateVertex,
    reduceDimensions,
    verifyReducedSolution
} from './utils/math';
import {
    ThemeProvider,
    createTheme,
    CssBaseline,
    Container,
    Typography,
    Box,
    Grid,
    Paper,
    TextField,
    Button,
    Select,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    FormControl,
    Checkbox,
    FormControlLabel
} from '@mui/material';

const SOLUTION_FILES = import.meta.glob('./solutions/*.txt', { as: 'raw', eager: true });
const DEFAULT_SOLUTIONS: Record<string, string> = {};
for (const path in SOLUTION_FILES) {
    const name = path.split('/').pop()?.replace('.txt', '') || path;
    DEFAULT_SOLUTIONS[name] = SOLUTION_FILES[path] as any;
}

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#000' },
        secondary: { main: '#666' },
        background: { default: '#fff' }
    },
    typography: {
        fontFamily: ['Arial', 'sans-serif'].join(','),
        h3: { fontWeight: 900, letterSpacing: '-0.02em', fontSize: '2rem' },
        h4: { fontWeight: 800, fontSize: '1.6rem' },
        h5: { fontWeight: 700, fontSize: '1.2rem' },
        h6: { fontFamily: 'inherit', fontWeight: 700, fontSize: '1rem', textTransform: 'none' },
        body1: { fontSize: '1rem', lineHeight: 1.6 },
        button: { textTransform: 'none', fontWeight: 700, fontSize: '0.9rem' },
        overline: { fontSize: '0.75rem', letterSpacing: 1, textTransform: 'none' }
    },
    components: {
        MuiTableCell: {
            styleOverrides: {
                root: { padding: '8px', border: '1px solid #eee' }
            }
        },
        MuiPaper: {
            styleOverrides: {
                root: { borderRadius: 0, border: '1px solid #e0e0e0' }
            }
        }
    }
});

function App() {
    const [dimension, setDimension] = useState(10);
    const [numHyperplanes, setNumHyperplanes] = useState(10);
    const [coefficients, setCoefficients] = useState<(string | number)[][]>([]);
    const [results, setResults] = useState<{
        full: { sliced: number, total: number },
        reduced: { sliced: number, total: number }
    } | null>(null);
    const [hasConstant, setHasConstant] = useState(true);
    const [rawMatrix, setRawMatrix] = useState("");
    const [selectedSolution, setSelectedSolution] = useState("");

    const [v1Input, setV1Input] = useState<number[]>([]);
    const [v2Input, setV2Input] = useState<number[]>([]);
    const [evalResults, setEvalResults] = useState<{ v1: number[], v2: number[], v1Evals: number[], v2Evals: number[], sliced: boolean[] } | null>(null);

    const [showTextArea, setShowTextArea] = useState(false);

    // Derived numeric matrix for calculations
    const numericCoefficients = coefficients.map(row => row.map(v => typeof v === 'string' ? parseFloat(v) || 0 : v));

    // Get auto-detected partitions
    const autoReduced = useMemo(() => {
        return reduceDimensions(numericCoefficients, hasConstant);
    }, [numericCoefficients, hasConstant]);

    const currentPartitions = autoReduced.groupSizes;

    // Calculate V and E for Info panel and stats
    const reducedStats = useMemo(() => {
        const v = currentPartitions.reduce((p, s) => p * (s + 1), 1);
        const e = v * currentPartitions.length - currentPartitions.map(p => v / (p + 1)).reduce((a: number, b: number) => a + b, 0);
        return { v, e };
    }, [currentPartitions]);

    // Initial load of default solution
    useEffect(() => {
        // Use the exact key as it appears in DEFAULT_SOLUTIONS
        const defaultName = Object.keys(DEFAULT_SOLUTIONS).sort().find(k => k.includes("n=10") && k.includes("k=8") && k.includes("Solution 1")) || "n=10, k=8 Solution 1";
        const content = DEFAULT_SOLUTIONS[defaultName];
        if (content) {
            setSelectedSolution(defaultName);
            const parsed = parseCoefficientMatrix(content);
            if (parsed.length > 0) {
                const k = parsed.length;
                const cols = parsed[0].length;
                const n = hasConstant ? cols - 1 : cols;

                // Set these first to avoid the dimension/k useEffect trying to resize them
                setDimension(n);
                setNumHyperplanes(k);
                setCoefficients(parsed);

                // Calculate stats and evaluate a random edge
                const fullRes = verifySolution(n, parsed, hasConstant);
                const reduced = reduceDimensions(parsed, hasConstant);
                const reducedRes = verifyReducedSolution(reduced.groupSizes, reduced.reducedCoeffs, hasConstant);
                const totalReducedEdges = reduced.groupSizes.reduce((sum, s, i) => {
                    const prod = reduced.groupSizes.filter((_, idx) => idx !== i).reduce((p, v) => p * (v + 1), 1);
                    return sum + s * prod;
                }, 0);
                setResults({
                    full: { sliced: fullRes.totalScore, total: n * Math.pow(2, n - 1) },
                    reduced: { sliced: reducedRes.totalScore, total: totalReducedEdges }
                });

                // Evaluating a random edge
                const verticesCount = 1 << n;
                const v1Int = Math.floor(Math.random() * verticesCount);
                const bitToFlip = Math.floor(Math.random() * n);
                const coords1 = toCoords(v1Int, n);
                const coords2 = toCoords(v1Int ^ (1 << bitToFlip), n);
                setV1Input(coords1);
                setV2Input(coords2);

                const v1Evals = parsed.map((c: number[]) => evaluateVertex(c, coords1, hasConstant));
                const v2Evals = parsed.map((c: number[]) => evaluateVertex(c, coords2, hasConstant));
                const sliced = v1Evals.map((v1e: number, i: number) => v1e * v2Evals[i] < 0);
                setEvalResults({ v1: coords1, v2: coords2, v1Evals, v2Evals, sliced });
            }
        }
    }, []);

    useEffect(() => {
        const targetWidth = hasConstant ? dimension + 1 : dimension;
        let newCoeffs = [...coefficients];
        let updated = false;

        if (newCoeffs.length !== numHyperplanes) {
            if (newCoeffs.length < numHyperplanes) {
                while (newCoeffs.length < numHyperplanes) {
                    newCoeffs.push(Array(targetWidth).fill(0));
                }
            } else {
                newCoeffs = newCoeffs.slice(0, numHyperplanes);
            }
            updated = true;
        }

        if (newCoeffs[0] && newCoeffs[0].length !== targetWidth) {
            newCoeffs = newCoeffs.map(row => {
                if (row.length < targetWidth) {
                    return [...row, ...Array(targetWidth - row.length).fill(0)];
                } else {
                    return row.slice(0, targetWidth);
                }
            });
            updated = true;
        }

        if (updated) setCoefficients(newCoeffs);

        // Update v1/v2 inputs if dimension changed
        if (v1Input.length !== dimension) setV1Input(Array(dimension).fill(-1));
        if (v2Input.length !== dimension) setV2Input(Array(dimension).fill(1));

    }, [dimension, numHyperplanes, hasConstant]);

    // Automatic calculation of results when inputs change
    useEffect(() => {
        const timer = setTimeout(() => {
            if (numericCoefficients.length > 0) {
                const firstRow = numericCoefficients[0];
                const targetLen = (hasConstant ? dimension + 1 : dimension);
                if (firstRow.length === targetLen) {
                    // Full cube verification is very slow for large n, skip if n > 12
                    let fullRes = { totalScore: 0 };
                    if (dimension <= 12) {
                        fullRes = verifySolution(dimension, numericCoefficients, hasConstant);
                    }
                    
                    const reducedInfo = autoReduced;
                    const reducedRes = verifyReducedSolution(reducedInfo.groupSizes, reducedInfo.reducedCoeffs, hasConstant);
                    
                    setResults({
                        full: { 
                            sliced: dimension <= 12 ? fullRes.totalScore : (reducedRes.totalScore || 0), 
                            total: dimension * Math.pow(2, dimension - 1) 
                        },
                        reduced: { sliced: reducedRes.unweightedScore || 0, total: reducedStats.e }
                    });
                }
            }
        }, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [coefficients, dimension, hasConstant, currentPartitions, reducedStats.e, autoReduced]);

    // Automatic evaluation of the selected edge when vertex coordinates or coefficients change
    useEffect(() => {
        if (v1Input.length === dimension && v2Input.length === dimension && numericCoefficients.length > 0) {
            const targetLen = (hasConstant ? dimension + 1 : dimension);
            if (numericCoefficients[0].length === targetLen) {
                const v1Evals = numericCoefficients.map((c: number[]) => evaluateVertex(c, v1Input, hasConstant));
                const v2Evals = numericCoefficients.map((c: number[]) => evaluateVertex(c, v2Input, hasConstant));
                const sliced = v1Evals.map((v1e: number, i: number) => v1e * v2Evals[i] < 0);
                setEvalResults({ v1: v1Input, v2: v2Input, v1Evals, v2Evals, sliced });
            }
        }
    }, [v1Input, v2Input, coefficients, dimension, hasConstant]);

    const handleUpdateFromTextarea = () => {
        try {
            const parsed = parseCoefficientMatrix(rawMatrix);
            if (parsed.length > 0) {
                const k = parsed.length;
                const cols = parsed[0].length;
                const n = hasConstant ? cols - 1 : cols;

                setSelectedSolution("");
                setNumHyperplanes(k);
                setDimension(n);
                setCoefficients(parsed);
                calculateStats(parsed);
                setEvalResults(null);
            }
        } catch (e) {
            console.error("Failed to parse matrix", e);
        }
    };

    const handlePasteMatrix = (text: string) => {
        setRawMatrix(text);
        if (text.trim()) setSelectedSolution("");

        // Auto-update if it looks like a valid matrix
        try {
            const parsed = parseCoefficientMatrix(text);
            if (parsed.length > 0) {
                const k = parsed.length;
                const cols = parsed[0].length;
                const n = hasConstant ? cols - 1 : cols;
                setNumHyperplanes(k);
                setDimension(n);
                setCoefficients(parsed);
                calculateStats(parsed);
                setResults(null); 
                setEvalResults(null);
            }
        } catch (e) {
            // Silently ignore if it's not a full matrix yet
        }
    };

    const calculateStats = (matrix: number[][]) => {
        const fullRes = verifySolution(dimension, matrix, hasConstant);
        const reduced = reduceDimensions(matrix, hasConstant);
        const reducedRes = verifyReducedSolution(reduced.groupSizes, reduced.reducedCoeffs, hasConstant);
        const totalReducedEdges = reduced.groupSizes.reduce((sum, s, i) => {
            const prod = reduced.groupSizes.filter((_, idx) => idx !== i).reduce((p, v) => p * (v + 1), 1);
            return sum + s * prod;
        }, 0);
        setResults({
            full: { sliced: fullRes.totalScore, total: dimension * Math.pow(2, dimension - 1) },
            reduced: { sliced: reducedRes.totalScore, total: totalReducedEdges }
        });
    };

    const handleLoadDefault = (name: string) => {
        if (!name) {
            setSelectedSolution("");
            return;
        }
        const text = DEFAULT_SOLUTIONS[name];
        setRawMatrix(""); // Clear text area when selecting from dropdown
        setSelectedSolution(name);
        setEvalResults(null);
        const parsed = parseCoefficientMatrix(text);
        if (parsed.length > 0) {
            const k = parsed.length;
            const cols = parsed[0].length;
            const n = hasConstant ? cols - 1 : cols;

            setNumHyperplanes(k);
            setDimension(n);
            setCoefficients(parsed);
            calculateStats(parsed);
        }
    };



    const handleRandomEdge = () => {
        const verticesCount = 1 << dimension;
        const v1Int = Math.floor(Math.random() * verticesCount);
        const bitToFlip = Math.floor(Math.random() * dimension);
        const coords1 = toCoords(v1Int, dimension);
        const coords2 = toCoords(v1Int ^ (1 << bitToFlip), dimension);
        setV1Input(coords1);
        setV2Input(coords2);

        const v1Evals = numericCoefficients.map((c: number[]) => evaluateVertex(c, coords1, hasConstant));
        const v2Evals = numericCoefficients.map((c: number[]) => evaluateVertex(c, coords2, hasConstant));
        const sliced = v1Evals.map((v1e: number, i: number) => v1e * v2Evals[i] < 0);
        setEvalResults({ v1: coords1, v2: coords2, v1Evals, v2Evals, sliced });
    };

    const calculateReducedCoords = (vertex: number[], groups: number[][]) => {
        return groups.map(group => group.reduce((sum, idx) => sum + vertex[idx], 0));
    };

    const formatReducedEquation = (reducedCoeff: number[], reducedV: number[], result: number) => {
        if (!reducedCoeff || !reducedV) return null;
        const terms = reducedCoeff.slice(0, reducedV.length).map((c, i) => {
            const coeffStr = c === 1 ? "" : c === -1 ? "-" : c;
            return (
                <span key={i}>
                    {coeffStr}(<span style={{ color: '#d32f2f' }}>{reducedV[i]}</span>)
                    {i < reducedV.length - 1 ? " + " : ""}
                </span>
            );
        });
        const constant = reducedCoeff[reducedCoeff.length - 1];
        return (
            <>
                {terms}
                {hasConstant && constant !== 0 && ` - (${constant})`}
                {" = "}{result.toFixed(1)}
            </>
        );
    };

    const formatEquation = (coeff: number[], vertex: number[], result: number) => {
        if (!coeff || !vertex) return null;
        const terms = [];
        const n = vertex.length;
        for (let i = 0; i < n; i++) {
            if (coeff[i] !== 0) {
                const c = coeff[i] === 1 ? "" : coeff[i] === -1 ? "-" : coeff[i];
                terms.push({ coeff: c, val: vertex[i], idx: i });
            }
        }
        return (
            <>
                {terms.map((t, i) => (
                    <span key={t.idx}>
                        {t.coeff}(<span style={{ color: '#d32f2f' }}>{t.val}</span>)
                        {i < terms.length - 1 ? " + " : ""}
                    </span>
                ))}
                {hasConstant && coeff[n] !== 0 && ` - (${coeff[n]})`}
                {" = "}{result.toFixed(1)}
            </>
        );
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Container maxWidth="lg" sx={{ pt: 10, pb: 10, minHeight: '100vh', borderLeft: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }}>
                <Box component="header" sx={{ mb: 6, textAlign: 'center', pb: 2 }}>
                    <Typography variant="h3" sx={{ textDecoration: 'none', textAlign: 'center' }}>
                        Improved Upper Bounds for Slicing the Hypercube
                    </Typography>
                </Box>

                <Grid container spacing={6}>
                    {/* Top Left: Config */}
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <Box component="section">
                                <Typography variant="body2" sx={{ mb: 2 }}>
                                    The hypercube has <strong>{Math.pow(2, dimension)}</strong> vertices and <strong>{dimension * Math.pow(2, dimension - 1)}</strong> edges.
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 4 }}>
                                    The reduced hypercube has <strong>{reducedStats.v}</strong> vertices and <strong>{Math.round(reducedStats.e)}</strong> edges.
                                </Typography>
                                <Grid container spacing={3}>
                                    <Grid size={{ xs: 6 }}>
                                        <TextField fullWidth label="Dimension (n)" type="number" value={dimension} onChange={e => setDimension(parseInt(e.target.value) || 1)} variant="standard" />
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <TextField fullWidth label="Planes (k)" type="number" value={numHyperplanes} onChange={e => setNumHyperplanes(parseInt(e.target.value) || 1)} variant="standard" />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <Typography variant="caption" sx={{ color: '#888' }}>
                                            Auto-detected Symmetries: {currentPartitions.join(', ')}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <FormControlLabel control={<Checkbox checked={hasConstant} onChange={e => setHasConstant(e.target.checked)} color="default" />} label="include constant?" />
                                    </Grid>
                                </Grid>
                            </Box>

                            <Box component="section">
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                    <Typography variant="h6">Input Solution</Typography>
                                    <Button size="small" onClick={() => setShowTextArea(!showTextArea)} variant="text" color="inherit" sx={{ opacity: 0.5 }}>
                                        {showTextArea ? "Hide Paste" : "Paste Solution"}
                                    </Button>
                                </Box>
                                <FormControl fullWidth variant="standard" sx={{ mb: 3 }}>
                                    <Select
                                        value={selectedSolution}
                                        displayEmpty
                                        onChange={(e) => handleLoadDefault(e.target.value as string)}
                                    >
                                        <MenuItem value=""><em>Select a Solution..</em></MenuItem>
                                        {Object.keys(DEFAULT_SOLUTIONS).sort().map(name => (
                                            <MenuItem key={name} value={name}>{name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {showTextArea && (
                                    <>
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={6}
                                            value={rawMatrix}
                                            onChange={e => handlePasteMatrix(e.target.value)}
                                            placeholder="(e.g. one hyperplane per line -1 0 1 -1 1)"
                                            variant="outlined"
                                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 }, backgroundColor: '#fafafa', mb: 2 }}
                                        />
                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            color="secondary"
                                            onClick={handleUpdateFromTextarea}
                                            sx={{ py: 1 }}
                                        >
                                            Update
                                        </Button>
                                    </>
                                )}
                            </Box>
                        </Box>
                    </Grid>

                    {/* Top Right: Coefficients & Stats */}
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Box component="section" sx={{ mb: 6 }}>
                            <Typography variant="h5" sx={{ mb: 3 }}>Hyperplane Coefficients</Typography>
                            <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 500, overflow: 'auto' }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            {Array.from({ length: hasConstant ? dimension + 1 : dimension }).map((_, i) => (
                                                <TableCell key={i} align="center" sx={{ fontWeight: 900, fontSize: '0.75rem', backgroundColor: '#f5f5f5' }}>
                                                    {hasConstant && i === dimension ? "B" : `x${i + 1}`}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {coefficients.map((row, i) => (
                                            <TableRow key={i} hover>
                                                {row.map((val, j) => (
                                                    <TableCell key={j} sx={{ p: 0 }}>
                                                        <TextField 
                                                            size="small" 
                                                            type="text" 
                                                            value={val} 
                                                            onChange={e => {
                                                                const newVal = e.target.value;
                                                                // Allow only numbers and minus sign
                                                                if (newVal === "" || newVal === "-" || /^-?\d*\.?\d*$/.test(newVal)) {
                                                                    const n = [...coefficients];
                                                                    n[i] = [...n[i]];
                                                                    n[i][j] = newVal;
                                                                    setCoefficients(n);
                                                                }
                                                            }}
                                                            variant="standard"
                                                            InputProps={{ disableUnderline: true }}
                                                            inputProps={{ style: { textAlign: 'center', fontSize: '0.85rem', fontFamily: 'monospace' } }}
                                                            fullWidth
                                                        />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>

                        <Paper elevation={0} sx={{ p: 3, backgroundColor: '#f9f9f9', borderLeft: '4px solid black' }}>
                            <Grid container spacing={3}>
                                <Grid size={{ xs: 6 }}>
                                    <Typography variant="overline" color="textSecondary" sx={{ textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}>Hypercube</Typography>
                                    <Typography variant="h4">{results?.full?.sliced ?? 0} / {results?.full?.total ?? 0}</Typography>
                                    <Typography variant="caption" color="textSecondary">edges sliced</Typography>
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                    <Typography variant="overline" color="textSecondary" sx={{ textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}>Reduced Hypercube</Typography>
                                    <Typography variant="h4">{results?.reduced?.sliced ?? 0} / {results?.reduced?.total ?? 0}</Typography>
                                    <Typography variant="caption" color="textSecondary">edges sliced</Typography>
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* Bottom: Evaluate an Edge spanning full width, stacked vertically */}
                    <Grid size={{ xs: 12 }}>
                        <Box component="section" sx={{ mt: 10 }}>
                            <Typography variant="h5" sx={{ mb: 3 }}>Evaluate an Edge</Typography>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {/* Inputs & Buttons on Top */}
                                <Paper elevation={0} sx={{ p: 3, backgroundColor: '#fafafa', border: '1px solid #eee' }}>
                                    <Grid container spacing={4} alignItems="flex-end">
                                        <Grid size={{ xs: 12, md: 'auto' }}>
                                            <Typography variant="caption" sx={{ fontWeight: 800, mb: 0.5, display: 'block' }}>Vertex u</Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'nowrap', borderTop: '1px solid #e0e0e0', borderLeft: '1px solid #e0e0e0', backgroundColor: '#fff', width: 'fit-content' }}>
                                                {v1Input.map((val, idx) => (
                                                    <Box
                                                        key={idx}
                                                        onClick={() => {
                                                            const n = [...v1Input];
                                                            n[idx] = val === 1 ? -1 : 1;
                                                            setV1Input(n);
                                                        }}
                                                        sx={{
                                                            flex: '0 0 auto',
                                                            minWidth: 40,
                                                            height: 36,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            borderRight: '1px solid #e0e0e0',
                                                            borderBottom: '1px solid #e0e0e0',
                                                            fontSize: '0.9rem',
                                                            fontFamily: 'monospace',
                                                            '&:hover': { backgroundColor: '#f5f5f5' },
                                                            userSelect: 'none'
                                                        }}
                                                    >
                                                        {val}
                                                    </Box>
                                                ))}
                                            </Box>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 'auto' }}>
                                            <Typography variant="caption" sx={{ fontWeight: 800, mb: 0.5, display: 'block' }}>Vertex v</Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'nowrap', borderTop: '1px solid #e0e0e0', borderLeft: '1px solid #e0e0e0', backgroundColor: '#fff', width: 'fit-content' }}>
                                                {v2Input.map((val, idx) => (
                                                    <Box
                                                        key={idx}
                                                        onClick={() => {
                                                            const n = [...v2Input];
                                                            n[idx] = val === 1 ? -1 : 1;
                                                            setV2Input(n);
                                                        }}
                                                        sx={{
                                                            flex: '0 0 auto',
                                                            minWidth: 40,
                                                            height: 36,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            borderRight: '1px solid #e0e0e0',
                                                            borderBottom: '1px solid #e0e0e0',
                                                            fontSize: '0.9rem',
                                                            fontFamily: 'monospace',
                                                            '&:hover': { backgroundColor: '#f5f5f5' },
                                                            userSelect: 'none'
                                                        }}
                                                    >
                                                        {val}
                                                    </Box>
                                                ))}
                                            </Box>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 'auto' }}>
                                            <Box sx={{ display: 'flex', gap: 2 }}>
                                                <Button variant="outlined" color="primary" onClick={handleRandomEdge} sx={{ px: 4, py: 1.5 }}>Random Edge</Button>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                </Paper>

                                {/* Table Below */}
                                {evalResults && (
                                    <TableContainer component={Paper} elevation={0}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                                    <TableCell align="center" sx={{ fontWeight: 800, width: 60 }}>Plane</TableCell>
                                                    <TableCell sx={{ fontWeight: 800 }}>Hypercube Evaluation</TableCell>
                                                    <TableCell sx={{ fontWeight: 800 }}>Reduced Hypercube Evaluation</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 800, width: 80 }}>Sliced?</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {evalResults.sliced.map((s, i) => {
                                                    const r = autoReduced;
                                                    const ru = calculateReducedCoords(evalResults.v1, r.mappings);
                                                    const rv = calculateReducedCoords(evalResults.v2, r.mappings);
                                                    return (
                                                        <TableRow key={i} hover>
                                                            <TableCell align="center" sx={{ color: '#888', fontWeight: 600 }}>{i + 1}</TableCell>
                                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.9rem', py: 2 }}>
                                                                <Box sx={{ color: '#555' }}>
                                                                    <Box>u: {formatEquation(numericCoefficients[i], evalResults.v1, evalResults.v1Evals[i])}</Box>
                                                                    <Box>v: {formatEquation(numericCoefficients[i], evalResults.v2, evalResults.v2Evals[i])}</Box>
                                                                </Box>
                                                            </TableCell>
                                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.9rem', py: 2 }}>
                                                                <Box sx={{ color: '#555' }}>
                                                                    <Box>uᵝ: {formatReducedEquation(r.reducedCoeffs[i], ru, evalResults.v1Evals[i])}</Box>
                                                                    <Box>vᵝ: {formatReducedEquation(r.reducedCoeffs[i], rv, evalResults.v2Evals[i])}</Box>
                                                                </Box>
                                                            </TableCell>
                                                            <TableCell align="center">
                                                                {s ? (
                                                                    <Box component="span" sx={{ color: '#2e7d32', fontWeight: 900, fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</Box>
                                                                ) : (
                                                                    <Box component="span" sx={{ color: '#ccc' }}>—</Box>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </Box>
                        </Box>
                    </Grid>
                </Grid>
            </Container>
        </ThemeProvider>
    );
}

export default App;
