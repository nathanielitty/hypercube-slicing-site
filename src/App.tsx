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
    responsiveFontSizes,
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
    FormControlLabel,
    Collapse,
    Divider,
    Switch,
} from '@mui/material';

const SOLUTION_FILES = import.meta.glob('./solutions/*.txt', { as: 'raw', eager: true });
const DEFAULT_SOLUTIONS: Record<string, string> = {};
for (const path in SOLUTION_FILES) {
    const name = path.split('/').pop()?.replace('.txt', '') || path;
    DEFAULT_SOLUTIONS[name] = SOLUTION_FILES[path] as any;
}

function parseSolution(name: string) {
    const parsed = parseCoefficientMatrix(DEFAULT_SOLUTIONS[name] || "");
    const n = parsed.length > 0 ? parsed[0].length - 1 : 10;
    return { name, parsed, n, k: parsed.length || 10 };
}

const INITIAL = parseSolution(
    Object.keys(DEFAULT_SOLUTIONS).sort().find(k => k.includes("n=10") && k.includes("k=8") && k.includes("Solution 1")) || ""
);

let theme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#1a3a5c' },
        secondary: { main: '#4a7fa5' },
        background: { default: '#0d2137' },
        text: { primary: '#1a1a2e', secondary: '#4a5568' },
    },
    typography: {
        fontFamily: ['Arial', 'sans-serif'].join(','),
        h3: { fontWeight: 900, letterSpacing: '-0.02em', fontSize: '2.5rem' },
        h4: { fontWeight: 800, fontSize: '1.8rem' },
        h5: { fontWeight: 700, fontSize: '1.4rem' },
        h6: { fontFamily: 'inherit', fontWeight: 700, fontSize: '1.2rem', textTransform: 'none' },
        body1: { fontSize: '1.15rem', lineHeight: 1.6 },
        body2: { fontSize: '1.05rem', lineHeight: 1.6 },
        button: { textTransform: 'none', fontWeight: 700, fontSize: '1rem' },
        overline: { fontSize: '0.85rem', letterSpacing: 1.5, textTransform: 'none' },
        caption: { fontSize: '0.9rem' },
    },
    components: {
        MuiTableCell: {
            styleOverrides: {
                root: { padding: '10px 12px', border: '1px solid #e8edf2', fontFamily: 'inherit' }
            }
        },
        MuiPaper: {
            styleOverrides: {
                root: { borderRadius: 10, border: '1px solid #dde5ee' }
            }
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&:hover td': { backgroundColor: '#dbeafe !important' },
                }
            }
        },
        MuiInputBase: {
            styleOverrides: {
                root: { fontSize: '1.05rem' }
            }
        },
        MuiFormLabel: {
            styleOverrides: {
                root: { fontSize: '1rem' }
            }
        }
    }
});

theme = responsiveFontSizes(theme);

function App() {
    const [dimension, setDimension] = useState(INITIAL.n);
    const [numHyperplanes, setNumHyperplanes] = useState(INITIAL.k);
    const [coefficients, setCoefficients] = useState<(string | number)[][]>(INITIAL.parsed);
    const [results, setResults] = useState<{
        full: { sliced: number, total: number },
        reduced: { sliced: number, total: number },
        cutsPerHyperplane: number[],
    } | null>(null);
    const [hasConstant, setHasConstant] = useState(true);
    const [rawMatrix, setRawMatrix] = useState("");
    const [selectedSolution, setSelectedSolution] = useState(INITIAL.name);

    const [v1Input, setV1Input] = useState<number[]>([]);
    const [v2Input, setV2Input] = useState<number[]>([]);
    const [evalResults, setEvalResults] = useState<{ v1: number[], v2: number[], v1Evals: number[], v2Evals: number[], sliced: boolean[] } | null>(null);

    const [showTextArea, setShowTextArea] = useState(false);
    const [showReducedEval, setShowReducedEval] = useState(false);
    const [showReducedScoreFooter, setShowReducedScoreFooter] = useState(false);

    useEffect(() => {
        // Trigger KaTeX rendering after mount
        if (typeof (window as any).renderMathInElement === 'function') {
            (window as any).renderMathInElement(document.body, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false
            });
        }
    }, []);

    const numericCoefficients = useMemo(
        () => coefficients.map(row => row.map(v => typeof v === 'string' ? parseFloat(v) || 0 : v)),
        [coefficients]
    );

    const autoReduced = useMemo(() => {
        return reduceDimensions(numericCoefficients, hasConstant);
    }, [numericCoefficients, hasConstant]);

    const currentPartitions = autoReduced.groupSizes;

    const reducedStats = useMemo(() => {
        const v = currentPartitions.reduce((p, s) => p * (s + 1), 1);
        const e = v * currentPartitions.length - currentPartitions.map(p => v / (p + 1)).reduce((a: number, b: number) => a + b, 0);
        return { v, e };
    }, [currentPartitions]);

    useEffect(() => {
        if (INITIAL.parsed.length > 0) {
            const { parsed, n } = INITIAL;
            const fullRes = verifySolution(n, parsed, hasConstant);
            const reduced = reduceDimensions(parsed, hasConstant);
            const reducedRes = verifyReducedSolution(reduced.groupSizes, reduced.reducedCoeffs, hasConstant);
            const v = reduced.groupSizes.reduce((p: number, s: number) => p * (s + 1), 1);
            const e = v * reduced.groupSizes.length - reduced.groupSizes.map((p: number) => v / (p + 1)).reduce((a: number, b: number) => a + b, 0);
            setResults({
                full: { sliced: fullRes.totalScore, total: n * Math.pow(2, n - 1) },
                reduced: { sliced: reducedRes.unweightedScore || 0, total: Math.round(e) },
                cutsPerHyperplane: fullRes.cutsPerHyperplane,
            });
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
        if (v1Input.length !== dimension) setV1Input(Array(dimension).fill(-1));
        if (v2Input.length !== dimension) setV2Input(Array(dimension).fill(1));
    }, [dimension, numHyperplanes, hasConstant]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const numericCoeffs = coefficients.map(row => row.map(v => typeof v === 'string' ? parseFloat(v) || 0 : v));
            if (numericCoeffs.length > 0) {
                const firstRow = numericCoeffs[0];
                const targetLen = (hasConstant ? dimension + 1 : dimension);
                if (firstRow.length === targetLen) {
                    let fullScore = 0;
                    let cutsPerHyperplane: number[] = new Array(numericCoeffs.length).fill(0);
                    if (dimension <= 12) {
                        const fullRes = verifySolution(dimension, numericCoeffs, hasConstant);
                        fullScore = fullRes.totalScore;
                        cutsPerHyperplane = fullRes.cutsPerHyperplane;
                    }
                    const reducedInfo = reduceDimensions(numericCoeffs, hasConstant);
                    const reducedRes = verifyReducedSolution(reducedInfo.groupSizes, reducedInfo.reducedCoeffs, hasConstant);
                    const v = reducedInfo.groupSizes.reduce((p: number, s: number) => p * (s + 1), 1);
                    const e = v * reducedInfo.groupSizes.length - reducedInfo.groupSizes.map((p: number) => v / (p + 1)).reduce((a: number, b: number) => a + b, 0);
                    setResults({
                        full: {
                            sliced: dimension <= 12 ? fullScore : reducedRes.totalScore,
                            total: dimension * Math.pow(2, dimension - 1)
                        },
                        reduced: { sliced: reducedRes.unweightedScore || 0, total: Math.round(e) },
                        cutsPerHyperplane: dimension <= 12 ? cutsPerHyperplane : reducedRes.cutsPerHyperplane,
                    });
                }
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [coefficients, dimension, hasConstant]);

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
                setEvalResults(null);
            }
        } catch (e) {
            console.error("Failed to parse matrix", e);
        }
    };

    const handlePasteMatrix = (text: string) => {
        setRawMatrix(text);
        if (text.trim()) setSelectedSolution("");
        try {
            const parsed = parseCoefficientMatrix(text);
            if (parsed.length > 0) {
                const k = parsed.length;
                const cols = parsed[0].length;
                const n = hasConstant ? cols - 1 : cols;
                setNumHyperplanes(k);
                setDimension(n);
                setCoefficients(parsed);
                setResults(null);
                setEvalResults(null);
            }
        } catch (e) { /* ignore partial input */ }
    };

    const handleLoadDefault = (name: string) => {
        if (!name) { setSelectedSolution(""); return; }
        const text = DEFAULT_SOLUTIONS[name];
        setRawMatrix("");
        setSelectedSolution(name);
        setEvalResults(null);
        setHasConstant(true);
        const parsed = parseCoefficientMatrix(text);
        if (parsed.length > 0) {
            const k = parsed.length;
            const cols = parsed[0].length;
            const n = cols - 1;
            setNumHyperplanes(k);
            setDimension(n);
            setCoefficients(parsed);
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

    const calculateReducedCoords = (vertex: number[], groups: number[][]) =>
        groups.map(group => group.reduce((sum, idx) => sum + vertex[idx], 0));

    const formatReducedEquation = (reducedCoeff: number[], reducedV: number[], result: number) => {
        if (!reducedCoeff || !reducedV) return null;
        const terms = reducedCoeff.slice(0, reducedV.length).map((c, i) => ({ c, val: reducedV[i], i }));
        const constant = reducedCoeff[reducedCoeff.length - 1];
        return (
            <>
                {terms.map((t, idx) => (
                    <span key={t.i}>
                        {idx > 0 && " + "}{t.c}(<span style={{ color: '#c0392b' }}>{t.val}</span>)
                    </span>
                ))}
                {hasConstant && constant !== 0 && ` + ${constant}`}
                {" "}<strong>= {result.toFixed(1)}</strong>
            </>
        );
    };

    const formatEquation = (coeff: number[], vertex: number[], result: number) => {
        if (!coeff || !vertex) return null;
        const n = vertex.length;
        const terms: { coeff: number, val: number, idx: number }[] = [];
        for (let i = 0; i < n; i++) {
            if (coeff[i] !== 0) terms.push({ coeff: coeff[i], val: vertex[i], idx: i });
        }
        return (
            <>
                {terms.map((t, i) => (
                    <span key={t.idx}>
                        {i > 0 && " + "}{t.coeff}(<span style={{ color: '#c0392b' }}>{t.val}</span>)
                    </span>
                ))}
                {hasConstant && coeff[n] !== 0 && ` + ${coeff[n]}`}
                {" "}<strong>= {result.toFixed(1)}</strong>
            </>
        );
    };

    const cardSx = {
        backgroundColor: '#ffffff',
        border: '1px solid #dde5ee',
        borderRadius: '10px',
        p: 3,
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{
                minHeight: '100vh',
                background: 'linear-gradient(160deg, #0d2137 0%, #1a3a5c 50%, #14304e 100%)',
                py: 6,
            }}>
                <Container maxWidth="lg">
                    <Box component="header" sx={{ mb: 5, textAlign: 'center' }}>
                        <Typography variant="h3" sx={{
                            color: '#ffffff',
                            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            mb: 0,
                        }}>
                            Improved Upper Bounds for Slicing the Hypercube
                        </Typography>
                    </Box>

                    <Box sx={{ ...cardSx, mb: 4, borderLeft: '4px solid #1a3a5c' }}>
                        <Typography variant="h6" sx={{ mb: 1.5, color: '#1a3a5c' }}>About</Typography>
                        <Typography variant="body2" sx={{ mb: 1.5, color: '#444', lineHeight: 1.8 }}>
                            The Slicing the Hypercube problem aims to find the minimum number of hyperplanes, denoted {'$S(n)$'}, needed to intersect every edge of an {'$n$'}-dimensional hypercube with vertex set {'$\\{-1, 1\\}^n$'}.
                            An edge is sliced by a hyperplane if the two vertices connected by the edge lie on opposite sides of the hyperplane.
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5, color: '#444', lineHeight: 1.8 }}>
                            Our work improves the decades-old upper bound of {'$S(n) \\leq \\lceil \\frac{5n}{6} \\rceil$'} established in 1971 by Mike Paterson.
                            We prove that {'$S(n) \\leq \\lceil \\frac{4n}{5} \\rceil$'}, except when {'$n$'} is an odd multiple of 5, in which case {'$S(n) \\leq \\frac{4n}{5} + 1$'}, with the discovery of {'$8$'} hyperplanes for {'$n=10$'} that slice all 5120 edges. This new upper bound was found using local search techniques, aided by the recently introduced CPro1.
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            <Typography variant="body2">
                                <a href="https://arxiv.org/abs/2602.16807" target="_blank" rel="noopener noreferrer"
                                    style={{ color: '#1a3a5c', fontWeight: 700 }}>
                                    Read the Paper
                                </a>
                            </Typography>
                            <Typography variant="body2">
                                <a href="https://github.com/DSoiffer/upper-bounds-for-hypercube-slicing" target="_blank" rel="noopener noreferrer"
                                    style={{ color: '#1a3a5c', fontWeight: 700 }}>
                                    GitHub
                                </a>
                            </Typography>
                            <Typography variant="body2">
                                <a href="https://blog.computationalcomplexity.org/2021/03/slicing-hypercube.html" target="_blank" rel="noopener noreferrer"
                                    style={{ color: '#1a3a5c', fontWeight: 700 }}>
                                    Background on the Problem
                                </a>
                            </Typography>
                        </Box>
                    </Box>

                    <Grid container spacing={4}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                                <Box sx={cardSx}>
                                    <Typography variant="h6" sx={{ mb: 2, color: '#1a3a5c' }}>Configuration</Typography>

                                    <Grid container spacing={2} sx={{ mb: 2 }} alignItems="flex-end">
                                        <Grid size={{ xs: 6 }}>
                                            <TextField fullWidth label="n" type="number" value={dimension}
                                                onChange={e => setDimension(parseInt(e.target.value) || 1)} variant="standard" />
                                        </Grid>
                                        <Grid size={{ xs: 6 }}>
                                            <TextField fullWidth label="k" type="number" value={numHyperplanes}
                                                onChange={e => setNumHyperplanes(parseInt(e.target.value) || 1)} variant="standard" />
                                        </Grid>
                                    </Grid>

                                    <Typography variant="body2" sx={{ mb: 2, color: '#555' }}>
                                        The hypercube has <strong>{Math.pow(2, dimension)}</strong> vertices and{' '}
                                        <strong>{dimension * Math.pow(2, dimension - 1)}</strong> edges.
                                    </Typography>

                                    <FormControlLabel
                                        control={<Checkbox checked={hasConstant} onChange={e => setHasConstant(e.target.checked)} color="default" size="small" />}
                                        label={<Typography variant="body2">include constant?</Typography>}
                                    />

                                    <Divider sx={{ my: 2 }} />

                                    <Box>
                                        <Typography variant="h6" sx={{ mb: 1.5, color: '#1a3a5c' }}>Solution</Typography>

                                        <FormControl fullWidth variant="standard" sx={{ mb: 2 }}>
                                            <Select value={selectedSolution} displayEmpty
                                                onChange={(e) => handleLoadDefault(e.target.value as string)}
                                                sx={{ fontSize: '1rem' }}>
                                                <MenuItem value=""><em>Select a solution…</em></MenuItem>
                                                {Object.keys(DEFAULT_SOLUTIONS).sort().map(name => (
                                                    <MenuItem key={name} value={name} sx={{ fontSize: '1rem' }}>{name}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>

                                        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
                                            <Button size="small" onClick={() => setShowTextArea(!showTextArea)} variant="text" color="inherit"
                                                sx={{ opacity: 0.6, fontSize: '0.85rem' }}>
                                                {showTextArea ? "Hide Paste" : "Paste Solution"}
                                            </Button>
                                        </Box>

                                        <Collapse in={showTextArea}>
                                            <Box sx={{ mt: 1 }}>
                                                <TextField fullWidth multiline rows={5} value={rawMatrix}
                                                    onChange={e => handlePasteMatrix(e.target.value)}
                                                    placeholder="Paste hyperplanes with coefficients separated by a space, and a new line for each hyperplane. Ex: 1 1 1 3 2 3."
                                                    variant="outlined"
                                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 }, backgroundColor: '#fafafa', mb: 1.5 }} />
                                                <Button fullWidth variant="outlined" color="primary"
                                                    onClick={handleUpdateFromTextarea} sx={{ py: 1 }}>
                                                    Update Matrix
                                                </Button>
                                            </Box>
                                        </Collapse>
                                    </Box>
                                </Box>

                            </Box>
                        </Grid>

                        <Grid size={{ xs: 12, md: 8 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <Box component="section" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    <Typography variant="h5" sx={{ color: '#ffffff', mb: 2 }}>
                                        Hyperplane Coefficients
                                    </Typography>

                                    <Paper elevation={0} sx={{
                                        borderRadius: '10px',
                                        border: '1px solid #ffffff',
                                        overflow: 'hidden',
                                        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
                                        backgroundColor: '#ffffff',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        <TableContainer sx={{ maxHeight: 600, overflow: 'auto' }}>
                                            <Table size="small" stickyHeader>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell align="center"
                                                            sx={{ fontWeight: 900, fontSize: '0.85rem', backgroundColor: '#e8edf5' }}>
                                                            Hyperplane
                                                        </TableCell>
                                                        {Array.from({ length: hasConstant ? dimension + 1 : dimension }).map((_, i) => (
                                                            <TableCell key={i} align="center"
                                                                sx={{ fontWeight: 900, fontSize: '0.85rem', backgroundColor: '#e8edf5' }}>
                                                                {hasConstant && i === dimension ? "C" : `x${i + 1}`}
                                                            </TableCell>
                                                        ))}
                                                        <TableCell align="center"
                                                            sx={{
                                                                fontWeight: 900, fontSize: '0.85rem', backgroundColor: '#e8edf5', whiteSpace: 'nowrap',
                                                                position: 'sticky', right: 0, zIndex: 3, boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.1)'
                                                            }}>
                                                            Edges Sliced
                                                        </TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {coefficients.map((row, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell align="center"
                                                                sx={{ color: '#888', fontWeight: 700, fontSize: '0.95rem', backgroundColor: '#f9fbfd' }}>
                                                                {i + 1}
                                                            </TableCell>
                                                            {row.map((val, j) => (
                                                                <TableCell key={j} sx={{ p: 0 }}>
                                                                    <TextField
                                                                        size="small" type="text" value={val}
                                                                        onChange={e => {
                                                                            const newVal = e.target.value;
                                                                            if (newVal === "" || newVal === "-" || /^-?\d*\.?\d*$/.test(newVal)) {
                                                                                const n = [...coefficients];
                                                                                n[i] = [...n[i]];
                                                                                n[i][j] = newVal;
                                                                                setCoefficients(n);
                                                                            }
                                                                        }}
                                                                        variant="standard"
                                                                        InputProps={{ disableUnderline: true }}
                                                                        inputProps={{ style: { textAlign: 'center', fontSize: '1rem', fontFamily: 'monospace' } }}
                                                                        fullWidth
                                                                    />
                                                                </TableCell>
                                                            ))}
                                                            <TableCell align="center"
                                                                sx={{
                                                                    fontWeight: 700, fontSize: '0.95rem', color: results?.cutsPerHyperplane?.[i] ? '#1a3a5c' : '#aaa',
                                                                    backgroundColor: '#f9fbfd', whiteSpace: 'nowrap',
                                                                    position: 'sticky', right: 0, zIndex: 1, boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.1)'
                                                                }}>
                                                                {results?.cutsPerHyperplane?.[i] ?? '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>

                                        <Box sx={{
                                            p: 2.5,
                                            backgroundColor: '#f8fafc',
                                            borderTop: '1px solid #e2e8f0',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 1
                                        }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
                                                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                                                        {results?.full?.sliced ?? 0} / {results?.full?.total ?? 0}
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 700, opacity: 0.8 }}>edges sliced</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.5 }}>
                                                    <Typography variant="overline" sx={{ mr: 1, color: '#1a1a2e', fontWeight: 800, textTransform: 'none', fontSize: '0.9rem' }}>
                                                        Show Reduced Hypercube
                                                    </Typography>
                                                    <Switch size="small" checked={showReducedScoreFooter} onChange={e => setShowReducedScoreFooter(e.target.checked)} />
                                                </Box>
                                            </Box>
                                            <Collapse in={showReducedScoreFooter}>
                                                <Box sx={{
                                                    pt: 1.5,
                                                    borderTop: '1px dashed #cbd5e1',
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    columnGap: 4,
                                                    rowGap: 1
                                                }}>
                                                    <Typography variant="body1" sx={{ color: '#475569' }}>
                                                        Reduced: <strong>{results?.reduced?.sliced ?? 0} / {results?.reduced?.total ?? 0}</strong> edges sliced
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ color: '#475569' }}>
                                                        {reducedStats.v} vertices
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ color: '#475569' }}>
                                                        Composition: [{currentPartitions.join(', ')}]
                                                    </Typography>
                                                </Box>
                                            </Collapse>
                                        </Box>
                                    </Paper>
                                </Box>
                            </Box>
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                            <Box component="section">
                                <Typography variant="h5" sx={{ mb: 2, color: '#ffffff' }}>Evaluate an Edge</Typography>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <Box sx={{ ...cardSx, p: 0, pt: 3 }}>
                                        <Box sx={{ px: 3 }}>
                                            <Grid container spacing={3} alignItems="flex-start">
                                                <Grid size={{ xs: 12, md: 'auto' }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, mb: 1, display: 'block' }}>Vertex u</Typography>
                                                    <Box sx={{ display: 'flex', flexWrap: 'nowrap', borderTop: '1px solid #e0e0e0', borderLeft: '1px solid #e0e0e0', width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
                                                        {v1Input.map((val, idx) => (
                                                            <Box key={idx}
                                                                onClick={() => { const n = [...v1Input]; n[idx] = val === 1 ? -1 : 1; setV1Input(n); }}
                                                                sx={{
                                                                    flex: '0 0 auto', minWidth: 42, height: 38,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                    borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0',
                                                                    fontSize: '1.1rem', fontFamily: 'monospace',
                                                                    '&:hover': { backgroundColor: '#dbeafe' },
                                                                    userSelect: 'none'
                                                                }}>
                                                                {val}
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                    {showReducedEval && (
                                                        <Box sx={{ mt: 1.5, fontFamily: 'monospace', fontSize: '1rem', color: '#555', display: 'flex', alignItems: 'center' }}>
                                                            <Box component="span" sx={{ fontWeight: 900, mr: 1, color: '#1a3a5c' }}>u<sup>β</sup>:</Box>
                                                            ({calculateReducedCoords(v1Input, autoReduced.mappings).join(', ')})
                                                        </Box>
                                                    )}
                                                </Grid>
                                                <Grid size={{ xs: 12, md: 'auto' }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, mb: 1, display: 'block' }}>Vertex v</Typography>
                                                    <Box sx={{ display: 'flex', flexWrap: 'nowrap', borderTop: '1px solid #e0e0e0', borderLeft: '1px solid #e0e0e0', width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
                                                        {v2Input.map((val, idx) => (
                                                            <Box key={idx}
                                                                onClick={() => { const n = [...v2Input]; n[idx] = val === 1 ? -1 : 1; setV2Input(n); }}
                                                                sx={{
                                                                    flex: '0 0 auto', minWidth: 42, height: 38,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                    borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0',
                                                                    fontSize: '1.1rem', fontFamily: 'monospace',
                                                                    '&:hover': { backgroundColor: '#dbeafe' },
                                                                    userSelect: 'none'
                                                                }}>
                                                                {val}
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                    {showReducedEval && (
                                                        <Box sx={{ mt: 1.5, fontFamily: 'monospace', fontSize: '1rem', color: '#555', display: 'flex', alignItems: 'center' }}>
                                                            <Box component="span" sx={{ fontWeight: 900, mr: 1, color: '#1a3a5c' }}>v<sup>β</sup>:</Box>
                                                            ({calculateReducedCoords(v2Input, autoReduced.mappings).join(', ')})
                                                        </Box>
                                                    )}
                                                </Grid>
                                                <Grid size={{ xs: 12, md: 'auto' }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, mb: 1, display: 'block', visibility: 'hidden' }}>Spacer</Typography>
                                                    <Button variant="contained" color="primary" onClick={handleRandomEdge}
                                                        sx={{ px: 4, py: 1.25, boxShadow: 'none' }}>
                                                        Random Edge
                                                    </Button>
                                                </Grid>
                                            </Grid>
                                        </Box>

                                        <Box sx={{
                                            mt: 3,
                                            px: 3,
                                            py: 1,
                                            borderTop: '1px solid #f1f5f9',
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            alignItems: 'center',
                                            backgroundColor: '#f8fafc',
                                            borderBottomLeftRadius: '10px',
                                            borderBottomRightRadius: '10px'
                                        }}>
                                            <Typography variant="caption" sx={{ mr: 1, color: '#4a5568', fontWeight: 800, fontSize: '0.85rem' }}>
                                                Show Reduced Hypercube
                                            </Typography>
                                            <Switch size="small" checked={showReducedEval} onChange={e => setShowReducedEval(e.target.checked)} color="primary" />
                                        </Box>
                                    </Box>

                                    {evalResults && (
                                        <TableContainer component={Paper} elevation={0}
                                            sx={{ boxShadow: '0 4px 20px rgba(0,0,0,0.25)', borderRadius: '10px' }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow sx={{ backgroundColor: '#e8edf5' }}>
                                                        <TableCell align="center" sx={{ fontWeight: 800, minWidth: { xs: 80, sm: 100 }, width: { xs: 80, sm: 100 }, whiteSpace: 'nowrap' }}>Hyperplane</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }}>Evaluation</TableCell>
                                                        {showReducedEval && (
                                                            <TableCell sx={{ fontWeight: 800 }}>Reduced Evaluation</TableCell>
                                                        )}
                                                        <TableCell align="center" sx={{ fontWeight: 800, width: 90 }}>Sliced?</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {(() => {
                                                        const r = autoReduced;
                                                        const ru = calculateReducedCoords(evalResults.v1, r.mappings);
                                                        const rv = calculateReducedCoords(evalResults.v2, r.mappings);
                                                        return (
                                                            <>
                                                                {evalResults.sliced.map((s, i) => (
                                                                    <TableRow key={i}
                                                                        sx={{
                                                                            backgroundColor: s ? '#d1e9ff' : 'inherit',
                                                                            '&:hover td': { backgroundColor: s ? '#b3d9ff !important' : '#dbeafe !important' },
                                                                        }}>
                                                                        <TableCell align="center"
                                                                            sx={{ color: s ? '#1a3a5c' : '#888', fontWeight: 800, fontSize: '1.1rem' }}>
                                                                            {i + 1}
                                                                        </TableCell>
                                                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '1.05rem', py: 2 }}>
                                                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                                                <Box>
                                                                                    <Box component="span" sx={{ fontWeight: 900, mr: 1 }}>u:</Box>
                                                                                    <Box component="span" sx={{ color: s ? '#000' : '#444' }}>{formatEquation(numericCoefficients[i], evalResults.v1, evalResults.v1Evals[i])}</Box>
                                                                                </Box>
                                                                                <Box sx={{ borderTop: `1px solid ${s ? '#a9d0f5' : '#f0f0f0'}`, pt: 1 }}>
                                                                                    <Box component="span" sx={{ fontWeight: 900, mr: 1 }}>v:</Box>
                                                                                    <Box component="span" sx={{ color: s ? '#000' : '#444' }}>{formatEquation(numericCoefficients[i], evalResults.v2, evalResults.v2Evals[i])}</Box>
                                                                                </Box>
                                                                            </Box>
                                                                        </TableCell>
                                                                        {showReducedEval && (
                                                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '1.05rem', py: 2 }}>
                                                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                                                    <Box>
                                                                                        <Box component="span" sx={{ fontWeight: 900, mr: 1 }}>u<sup>β</sup>:</Box>
                                                                                        <Box component="span" sx={{ color: s ? '#000' : '#444' }}>{formatReducedEquation(r.reducedCoeffs[i], ru, evalResults.v1Evals[i])}</Box>
                                                                                    </Box>
                                                                                    <Box sx={{ borderTop: `1px solid ${s ? '#a9d0f5' : '#f0f0f0'}`, pt: 1 }}>
                                                                                        <Box component="span" sx={{ fontWeight: 900, mr: 1 }}>v<sup>β</sup>:</Box>
                                                                                        <Box component="span" sx={{ color: s ? '#000' : '#444' }}>{formatReducedEquation(r.reducedCoeffs[i], rv, evalResults.v2Evals[i])}</Box>
                                                                                    </Box>
                                                                                </Box>
                                                                            </TableCell>
                                                                        )}
                                                                        <TableCell align="center">
                                                                            {s ? (
                                                                                <Box component="span" sx={{ color: '#1a3a5c', fontWeight: 900, fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</Box>
                                                                            ) : (
                                                                                <Box component="span" sx={{ color: '#ccc' }}>—</Box>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </>
                                                        );
                                                    })()}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>
                </Container>
            </Box>
        </ThemeProvider>
    );
}

export default App;
