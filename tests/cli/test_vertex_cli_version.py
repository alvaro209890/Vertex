from __future__ import annotations

import json
from pathlib import Path


def test_vendored_vertex_cli_version_matches_python_package() -> None:
    repo = Path(__file__).resolve().parents[2]
    pyproject = (repo / "pyproject.toml").read_text(encoding="utf-8")
    cli_bundle = (repo / "vendor" / "vertex-cli" / "dist" / "cli.mjs").read_text(
        encoding="utf-8"
    )
    cli_package = json.loads(
        (repo / "vendor" / "vertex-cli" / "package.json").read_text(encoding="utf-8")
    )

    assert 'version = "1.1.3"' in pyproject
    assert cli_package["version"] == "1.1.3"
    assert 'version("1.1.3 (Vertex)"' in cli_bundle
    assert 'console.log(`${"1.1.3"} (Vertex)`)' in cli_bundle
