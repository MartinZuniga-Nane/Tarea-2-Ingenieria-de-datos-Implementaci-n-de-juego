from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "games" / "duel" / "newAssets"
TARGET_DIR = ROOT / "assets" / "games" / "duel" / "models"
STATE_ORDER = ["normal", "prepare", "attack", "victory", "defeat", "effect1", "effect2"]
PADDING = 16

SHEETS = [
  {
    "source": "Mobile - One Piece_ Treasure Cruise - Playable Characters - #0002 - Monkey D. Luffy - Gum-Gum Pistol.png",
    "modelId": "luffy",
    "states": {
      "normal": 0,
      "prepare": 9,
      "attack": 10,
      "victory": 5,
      "defeat": 8,
      "effect1": 11,
      "effect2": 12,
    },
  },
  {
    "source": "Mobile - One Piece_ Treasure Cruise - Playable Characters - #1023 - Portgas D. Ace - Dreams of Pirate King.png",
    "modelId": "ace",
    "states": {
      "normal": 3,
      "prepare": 12,
      "attack": 13,
      "victory": 1,
      "defeat": 10,
      "effect1": 25,
      "effect2": 27,
    },
  },
  {
    "source": "Mobile - One Piece_ Treasure Cruise - Playable Characters - #1414 - Sanji - Making Food and Drinks.png",
    "modelId": "sanji",
    "states": {
      "normal": 3,
      "prepare": 17,
      "attack": 23,
      "victory": 14,
      "defeat": 24,
      "effect1": 19,
      "effect2": 33,
    },
  },
  {
    "source": "Mobile - One Piece_ Treasure Cruise - Playable Characters - #1379 - Shanks - Red-Hair Pirates Leader.png",
    "modelId": "shanks",
    "states": {
      "normal": 4,
      "prepare": 13,
      "attack": 19,
      "victory": 14,
      "defeat": 12,
      "effect1": 28,
      "effect2": 27,
    },
  },
]


def is_background(pixel):
  r, g, b, a = pixel
  if a == 0:
    return True
  if abs(r - 230) < 10 and abs(g - 153) < 10 and b < 12:
    return True
  if r < 10 and g < 10 and b < 10:
    return True
  return False


def is_component_pixel(pixel):
  r, g, b, a = pixel
  if a == 0:
    return False
  if is_background(pixel):
    return False
  if r > 245 and g > 245 and b > 245:
    return False
  if g > 220 and r < 80 and b < 80:
    return False
  return True


def detect_components(image):
  width, height = image.size
  cutoff = height // 2
  pixels = image.load()
  visited = [[False] * width for _ in range(cutoff)]
  components = []

  for y in range(cutoff):
    for x in range(width):
      if visited[y][x]:
        continue

      visited[y][x] = True
      if not is_component_pixel(pixels[x, y]):
        continue

      stack = [(x, y)]
      min_x = max_x = x
      min_y = max_y = y
      count = 0

      while stack:
        current_x, current_y = stack.pop()
        count += 1
        min_x = min(min_x, current_x)
        max_x = max(max_x, current_x)
        min_y = min(min_y, current_y)
        max_y = max(max_y, current_y)

        for next_x, next_y in (
          (current_x + 1, current_y),
          (current_x - 1, current_y),
          (current_x, current_y + 1),
          (current_x, current_y - 1),
        ):
          if not (0 <= next_x < width and 0 <= next_y < cutoff):
            continue
          if visited[next_y][next_x]:
            continue

          visited[next_y][next_x] = True
          if is_component_pixel(pixels[next_x, next_y]):
            stack.append((next_x, next_y))

      if count > 1500:
        components.append((min_x, min_y, max_x, max_y))

  components.sort(key=lambda box: (box[1], box[0]))
  return components


def crop_component(image, box):
  left, top, right, bottom = box
  left = max(0, left - PADDING)
  top = max(0, top - PADDING)
  right = min(image.size[0] - 1, right + PADDING)
  bottom = min(image.size[1] - 1, bottom + PADDING)
  cropped = image.crop((left, top, right + 1, bottom + 1)).convert("RGBA")
  pixels = cropped.load()

  for y in range(cropped.size[1]):
    for x in range(cropped.size[0]):
      if is_background(pixels[x, y]):
        pixels[x, y] = (0, 0, 0, 0)

  bbox = cropped.getbbox()
  return cropped.crop(bbox) if bbox else cropped


def generate_sheet(sheet):
  source_path = SOURCE_DIR / sheet["source"]
  image = Image.open(source_path).convert("RGBA")
  components = detect_components(image)
  target_dir = TARGET_DIR / sheet["modelId"]
  target_dir.mkdir(parents=True, exist_ok=True)

  for state in STATE_ORDER:
    index = sheet["states"][state]
    sprite = crop_component(image, components[index])
    sprite.save(target_dir / f"{state}.png")

  print(f"Generated sprites for {sheet['modelId']}")


def main():
  for sheet in SHEETS:
    generate_sheet(sheet)


if __name__ == "__main__":
  main()
