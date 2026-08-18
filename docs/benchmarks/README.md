# Mid-Project Benchmark Evidence

This directory stores measured StreamWeaver performance results for the Infotact mid-project review.

Official review target:

- Upload a 2GB dataset through the real streaming upload path.
- Profile backend memory during the upload.
- Target peak server memory below approximately 150MB.
- Confirm the React virtualized preview remains bounded and scrolls smoothly.

## Required progression

Run the audit progressively rather than jumping directly to 2GB:

1. 100MB
2. 500MB
3. 1GB (1024MB)
4. 2GB (2048MB)

The PowerShell audit records actual measurements to `memory-audit.csv`.

Do not edit benchmark values manually and do not claim the 150MB target unless the recorded 2GB run passes it.

Generated benchmark CSV files are temporary and are excluded from Git.
