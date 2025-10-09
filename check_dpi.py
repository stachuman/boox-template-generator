import sys
sys.path.insert(0, 'src')
from einkpdf.core.profiles import load_device_profile, get_default_canvas_config
profile = load_device_profile('boox-note-air-4c')
print(f"Device Profile: {profile.name}")
print(f"Screen hardware: {profile.display['screen_size']} px")
print(f"PPI: {profile.display['ppi']}")
print(f"Orientation setting: {profile.pdf_settings['orientation']}")
# Get canvas config                                                                                       │
canvas = get_default_canvas_config(profile)
dims = canvas['dimensions']
print(f"✓ CORRECT CANVAS SIZE for boox-note-air-4c:")
print(f"  Width:  {dims['width']} pt")
print(f"  Height: {dims['height']} pt")
print(f"  Margins: {dims['margins']}")
# Show aspect ratio                                                                                       │
aspect = dims['width'] / dims['height']
print(f"Canvas aspect ratio: {aspect:.3f}")
print(f"Canvas orientation: {'PORTRAIT ✓' if dims['height'] > dims['width'] else 'LANDSCAPE'}")
# Verify PNG export dimensions
from einkpdf.core.profiles import get_png_target_dimensions
png_w, png_h = get_png_target_dimensions(profile)
print(f"PNG export dimensions: {png_w}×{png_h} px")
print(f"PNG orientation: {'portrait ✓' if png_h > png_w else 'landscape'}")
