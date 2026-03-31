export function generateEdges(n: number): [number[], number[]][] {
    const vertices = 1 << n; // 2^n
    const edges: [number[], number[]][] = [];

    for (let i = 0; i < vertices; i++) {
        for (let j = 0; j < n; j++) {
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

export function toCoords(val: number, n: number): number[] {
    const coords: number[] = [];
    for (let i = 0; i < n; i++) {
        coords.push(((val >> i) & 1) ? 1 : -1);
    }
    return coords;
}

export function edgeSliced(coeffs: number[], edge: [number[], number[]], constant: boolean = false): boolean {
    let constantTerm = 0;
    let normalVector = coeffs;

    if (constant && coeffs.length > 0) {
        constantTerm = coeffs[coeffs.length - 1];
        normalVector = coeffs.slice(0, coeffs.length - 1);
    }

    const v1 = edge[0];
    const v2 = edge[1];

    const dot = (a: number[], b: number[]) => a.reduce((sum, val, idx) => sum + val * b[idx], 0);

    const dot1 = dot(normalVector, v1) - constantTerm;
    const dot2 = dot(normalVector, v2) - constantTerm;

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
    hyperplanes: number[][],
    constant: boolean = false
): VerificationResult {
    const edges = generateEdges(n);

    const cutsPerHyperplane = new Array(hyperplanes.length).fill(0);
    let score = 0;

    for (const edge of edges) {
        let slicedByAny = false;
        for (let i = 0; i < hyperplanes.length; i++) {
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
        uniqueSlicesCount: score
    };
}

export function parseCoefficientMatrix(text: string): number[][] {
    const lines = text.trim().split(/\n+/);
    const results: number[][] = [];

    for (const line of lines) {
        let clean = line.trim();
        if (clean.startsWith('\\') || clean.startsWith('%')) continue;

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
    reducedCoeffs: number[][];
    groupSizes: number[];
    mappings: number[][];
}

export function reduceDimensions(coeffs: number[][], hasConstant: boolean = false): ReducedDimensionResult {
    if (coeffs.length === 0) return { reducedCoeffs: [], groupSizes: [], mappings: [] };

    const k = coeffs.length;
    let n = coeffs[0].length;

    const variableCount = hasConstant ? n - 1 : n;

    const dimVectors: string[] = [];
    for (let j = 0; j < variableCount; j++) {
        const col = [];
        for (let i = 0; i < k; i++) {
            col.push(coeffs[i][j]);
        }
        dimVectors.push(JSON.stringify(col));
    }

    const groups: Map<string, number[]> = new Map();
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

    for (let i = 0; i < k; i++) {
        const row: number[] = [];
        for (const vecStr of uniqueOrder) {
            const firstIdx = groups.get(vecStr)![0];
            row.push(coeffs[i][firstIdx]);
        }
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
    k: number;
    point: number[];
}

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
