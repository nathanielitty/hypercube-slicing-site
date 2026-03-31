
// Generate all edges for an n-dimensional hypercube
export function generateEdges(n: number): [number[], number[]][] {
    const vertices = 1 << n; // 2^n
    const edges: [number[], number[]][] = [];

    for (let i = 0; i < vertices; i++) {
        for (let j = 0; j < n; j++) {
            // If bit j is 0, then connection to i + (1<<j) exists
            // This avoids duplicates. We only flip 0 to 1.
            if (!((i >> j) & 1)) {
                const neighbor = i | (1 << j);
                edges.push([
                    toCoords(i, n),
                    toCoords(neighbor, n)
                ]);
            }
        }
    }
    return edges;
}


// Helper to convert integer to vertex coordinates
// Uses -1 instead of 0 for bit 0, and 1 for bit 1.
// This matches the Professor's definition where vertices are in {-1, 1}^n.
export function toCoords(val: number, n: number): number[] {
    const coords: number[] = [];
    for (let i = 0; i < n; i++) {
        // bit 0 -> -1, bit 1 -> 1
        coords.push(((val >> i) & 1) ? 1 : -1);
    }
    return coords;
}

// Convert coeffs and edge to boolean (sliced or not)
// coeffs: array of numbers
// edge: [v1, v2] where v1, v2 are coordinate arrays
// constant: boolean, if true, first element of coeffs is the constant term
// Actually, in the Professor's definition Ax = b, b is the constant term.
// In the current implementation AX - b = 0.
export function edgeSliced(coeffs: number[], edge: [number[], number[]], constant: boolean = false): boolean {
    let constantTerm = 0;
    let normalVector = coeffs;

    if (constant && coeffs.length > 0) {
        constantTerm = coeffs[coeffs.length - 1];
        normalVector = coeffs.slice(0, coeffs.length - 1);
    }

    const v1 = edge[0];
    const v2 = edge[1];

    // Dot product implementation
    const dot = (a: number[], b: number[]) => a.reduce((sum, val, idx) => sum + val * b[idx], 0);

    const dot1 = dot(normalVector, v1) - constantTerm;
    const dot2 = dot(normalVector, v2) - constantTerm;

    // A slice occurs if the vertices are on opposite sides of the hyperplane (one positive, one negative)
    return dot1 * dot2 < 0;
}

export function evaluateVertex(coeffs: number[], vertex: number[], constant: boolean = false): number {
    let constantTerm = 0;
    let normalVector = coeffs;

    if (constant && coeffs.length > 0) {
        constantTerm = coeffs[coeffs.length - 1];
        normalVector = coeffs.slice(0, coeffs.length - 1);
    }

    const dot = (a: number[], b: number[]) => a.reduce((sum, val, idx) => {
        // Handle cases where vectors might have different lengths if n changed but matrix didn't update yet
        if (idx >= b.length) return sum;
        return sum + val * b[idx]
    }, 0);

    return dot(normalVector, vertex) - constantTerm;
}

export interface VerificationResult {
    totalScore: number;
    unweightedScore?: number;
    cutsPerHyperplane: number[];
    uniqueSlicesCount: number;
}

export function verifySolution(
    n: number,
    hyperplanes: number[][], // List of coefficient arrays
    constant: boolean = false
): VerificationResult {
    // Generate edges on demand (or cache if we were optimizing, but JS is fast enough for n=10 typical)
    const edges = generateEdges(n);

    const cutsPerHyperplane = new Array(hyperplanes.length).fill(0);
    let score = 0;
    // We can track unique slices if needed, but the main goal is just counts
    // User asked for: "if plane 1 slices 120 edges... representation of 120 edges"

    // To match Python logic "if sliced: score += 1", this implies counting how many edges are cut by AT LEAST ONE plane?
    // Or is it sum of cuts?
    // Python code:
    // if sliced: score += 1
    // sliced = True if *any* hyperplane cuts it.
    // So 'score' is number of edges cut by the set union.
    // 'cutsPerHyperplane[i]' is individual counts.

    // We need 'cutsPerHyperplane' for the edge weights.

    for (const edge of edges) {
        let slicedByAny = false;
        for (let i = 0; i < hyperplanes.length; i++) {
            // Assume constant is 0 as per user default requirement usually, but supporting the flag
            // The user prompt says "assuming the constant is 0", so we can default to constant=False logic i.e. constant=0
            if (edgeSliced(hyperplanes[i], edge, constant)) {
                cutsPerHyperplane[i]++;
                slicedByAny = true;
            }
        }
        if (slicedByAny) {
            score++;
        }
    }

    return {
        totalScore: score,
        cutsPerHyperplane,
        uniqueSlicesCount: score // same as score in this logic
    };
}

export function parseCoefficientMatrix(text: string): number[][] {
    const lines = text.trim().split(/\n+/);
    const results: number[][] = [];

    for (const line of lines) {
        let clean = line.trim();
        // Skip LaTeX headers/footers
        if (clean.startsWith('\\') || clean.startsWith('%')) continue;
        
        // Remove LaTeX artifacts
        clean = clean.replace(/&/g, ' ').replace(/\\\\/g, '').trim();
        if (!clean) continue;

        const row = clean.split(/\s+/).map(val => parseFloat(val)).filter(v => !isNaN(v));
        if (row.length > 0) {
            results.push(row);
        }
    }
    return results;
}

export interface ReducedDimensionResult {
    reducedCoeffs: number[][]; // k x n_reduced
    groupSizes: number[]; // size of each reduced group
    mappings: number[][]; // [reduced_idx] -> [original_indices...]
}

export function reduceDimensions(coeffs: number[][], hasConstant: boolean = false): ReducedDimensionResult {
    if (coeffs.length === 0) return { reducedCoeffs: [], groupSizes: [], mappings: [] };

    const k = coeffs.length;
    let n = coeffs[0].length;

    // If hasConstant, the last column is the constant term. We don't reduce it.
    // We treat effectively n-1 variable columns.
    const variableCount = hasConstant ? n - 1 : n;

    // Transpose to get dimension vectors: dimVectors[d] = [c_{0,d}, c_{1,d}, ..., c_{k-1,d}]
    // We stringify them to find unique patterns.
    const dimVectors: string[] = [];
    for (let j = 0; j < variableCount; j++) {
        const col = [];
        for (let i = 0; i < k; i++) {
            col.push(coeffs[i][j]);
        }
        dimVectors.push(JSON.stringify(col));
    }

    // Group identical dimensions
    // reducedGroups is a list of [original_index, original_index...]
    const groups: Map<string, number[]> = new Map();
    // Maintain order of appearance for deterministic reduction
    const uniqueOrder: string[] = [];

    for (let j = 0; j < variableCount; j++) {
        const vecStr = dimVectors[j];
        if (!groups.has(vecStr)) {
            groups.set(vecStr, []);
            uniqueOrder.push(vecStr);
        }
        groups.get(vecStr)?.push(j);
    }

    const reducedCoeffs: number[][] = [];

    // Reconstruct coeffs based on unique groups
    for (let i = 0; i < k; i++) {
        const row: number[] = [];
        for (const vecStr of uniqueOrder) {
            // First index from the group tells us the coefficient
            const firstIdx = groups.get(vecStr)![0];
            row.push(coeffs[i][firstIdx]);
        }
        // If constant, append it to the end of reduced row
        if (hasConstant) {
            row.push(coeffs[i][n - 1]);
        }
        reducedCoeffs.push(row);
    }

    const mappings = uniqueOrder.map(v => groups.get(v)!);
    const groupSizes = mappings.map(m => m.length);

    return { reducedCoeffs, groupSizes, mappings };
}

function nCr(n: number, r: number): number {
    if (r < 0 || r > n) return 0;
    if (r === 0 || r === n) return 1;
    if (r > n / 2) r = n - r;
    let res = 1;
    for (let i = 1; i <= r; i++) {
        res = res * (n - i + 1) / i;
    }
    return Math.round(res);
}

interface GridEdge {
    coords: [number[], number[]];
    dim: number;
    k: number;      // initial grid coordinate in that dimension
    point: number[]; // initial grid coordinates for all dimensions
}

// Generate edges for the quotient graph (grid graph)
export function generateGridEdges(groupSizes: number[]): GridEdge[] {
    const n = groupSizes.length;
    const edges: GridEdge[] = [];

    const generateNodes = (dim: number, currentCoords: number[]): number[][] => {
        if (dim === n) return [[...currentCoords]];
        const nodes: number[][] = [];
        for (let i = 0; i <= groupSizes[dim]; i++) {
            const subNodes = generateNodes(dim + 1, [...currentCoords, i]);
            nodes.push(...subNodes);
        }
        return nodes;
    };

    const nodes = generateNodes(0, []);

    // Helper to convert grid coords to sumCoords
    const toSumCoords = (coords: number[]) => coords.map((k, i) => 2 * k - groupSizes[i]);

    for (let i = 0; i < nodes.length; i++) {
        const u = nodes[i];
        for (let d = 0; d < n; d++) {
            if (u[d] < groupSizes[d]) {
                const v = [...u];
                v[d]++;
                edges.push({
                    coords: [toSumCoords(u), toSumCoords(v)],
                    dim: d,
                    k: u[d],
                    point: [...u]
                });
            }
        }
    }
    return edges;
}

export function verifyReducedSolution(
    groupSizes: number[],
    hyperplanes: number[][],
    constant: boolean = false
): VerificationResult {
    const edges = generateGridEdges(groupSizes);
    const cutsPerHyperplane = new Array(hyperplanes.length).fill(0);
    let totalFullEdgesSliced = 0;
    let unweightedScore = 0;

    for (const edge of edges) {
        // Calculate the weight of this reduced edge (how many full edges it represents)
        const weight = groupSizes[edge.dim] * nCr(groupSizes[edge.dim] - 1, edge.k) * 
            groupSizes.reduce((prod, s, i) => i === edge.dim ? prod : prod * nCr(s, edge.point[i]), 1);

        let slicedByAny = false;
        for (let i = 0; i < hyperplanes.length; i++) {
            if (edgeSliced(hyperplanes[i], edge.coords, constant)) {
                cutsPerHyperplane[i] += weight;
                slicedByAny = true;
            }
        }
        if (slicedByAny) {
            totalFullEdgesSliced += weight;
            unweightedScore++;
        }
    }

    return {
        totalScore: totalFullEdgesSliced,
        unweightedScore,
        cutsPerHyperplane,
        uniqueSlicesCount: totalFullEdgesSliced
    };
}
