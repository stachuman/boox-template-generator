"""
Command-line interface for einkpdf.

This module provides the main CLI entry point for the e-ink PDF template system.
All commands follow the coding rules defined in CLAUDE.md.
"""

import click
from rich.console import Console
from rich.table import Table

console = Console()


@click.group()
@click.version_option(version="0.2.0", prog_name="einkpdf")
def main():
    """E-ink PDF Templates - Interactive PDF template system for Boox Onyx e-readers."""
    pass


@main.command()
@click.argument("template_path", type=click.Path(exists=True))
@click.argument("output_path", type=click.Path())
@click.option("--profile", required=True, help="Device profile (e.g., Boox-Note-Air-4C)")
@click.option("--mode", default="flattened", 
              type=click.Choice(["interactive", "flattened", "navigation_only"]),
              help="Export mode (default: flattened)")
@click.option("--strict", is_flag=True, help="Fail on constraint violations instead of auto-fixing")
def render(template_path: str, output_path: str, profile: str, mode: str, strict: bool):
    """Render a template to PDF."""
    console.print(f"[yellow]Rendering {template_path} with profile {profile}[/yellow]")
    
    # Following CLAUDE.md rule #4: Fail fast with meaningful exceptions
    raise NotImplementedError(
        "PDF rendering not implemented in Phase 1. "
        "This will be available after core schema validation is complete."
    )


@main.command()
@click.argument("template_path", type=click.Path(exists=True))
@click.option("--profile", help="Device profile for constraint validation")
@click.option("--strict", is_flag=True, help="Strict validation mode")
def validate(template_path: str, profile: str, strict: bool):
    """Validate a template against schema and device constraints."""
    console.print(f"[yellow]Validating {template_path}[/yellow]")
    
    # Following CLAUDE.md rule #4: Fail fast with meaningful exceptions  
    raise NotImplementedError(
        "Template validation not implemented in Phase 1. "
        "Schema validation system is currently being built."
    )


@main.command()
@click.argument("template_path", type=click.Path(exists=True))
@click.option("--page", default=1, help="Page number to preview (default: 1)")
@click.option("--scale", default=2.0, help="Preview scale factor (default: 2.0)")
@click.option("--output", help="Output PNG file path")
def preview(template_path: str, page: int, scale: float, output: str):
    """Generate ground truth PNG preview."""
    console.print(f"[yellow]Generating preview for {template_path}[/yellow]")
    
    # Following CLAUDE.md rule #4: Fail fast with meaningful exceptions
    raise NotImplementedError(
        "Ground truth preview not implemented in Phase 1. "
        "MuPDF integration pending after core renderer is complete."
    )


@main.command()
def profiles():
    """List available device profiles."""
    console.print("[bold blue]Available Device Profiles[/bold blue]")
    
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Profile Name", style="cyan")
    table.add_column("Screen Size", style="green")  
    table.add_column("PPI", justify="right", style="yellow")
    table.add_column("Status", style="red")
    
    # Placeholder data - will be populated when device profiles are implemented
    table.add_row("Boox-Note-Air-4C", "1872×1404", "227", "Not Implemented")
    table.add_row("Boox-Tab-Ultra-C", "2200×1650", "300", "Not Implemented")
    table.add_row("Boox-Go-10.3", "1872×1404", "227", "Not Implemented")
    
    console.print(table)
    console.print("\n[red]Device profiles not yet implemented in Phase 1[/red]")


if __name__ == "__main__":
    main()