"""Generate a deterministic bank of verified 5x5 Go puzzles.

Every puzzle is *constructed* and then *verified* with a small self-contained Go
engine, so the board is always consistent with its answer (no AI, no guessing).
Run:  python backend/scripts/gen_go_puzzles.py
Output: backend/data/go_puzzles.json  (used by go_puzzle_bank at runtime)
"""

from __future__ import annotations

import json
import random
from pathlib import Path

SIZE = 5
DIRS = [(-1, 0), (1, 0), (0, -1), (0, 1)]
TARGET_PER_TYPE = 20
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "go_puzzles.json"


# ── tiny go engine ────────────────────────────────────────────────────────
def coord(r: int, c: int) -> str:
    return f"{chr(65 + c)}{SIZE - r}"


def in_board(r: int, c: int) -> bool:
    return 0 <= r < SIZE and 0 <= c < SIZE


def neighbors(r: int, c: int):
    return [(r + dr, c + dc) for dr, dc in DIRS if in_board(r + dr, c + dc)]


def empty_grid():
    return [["." for _ in range(SIZE)] for _ in range(SIZE)]


def to_strings(g):
    return ["".join(row) for row in g]


def clone(g):
    return [row[:] for row in g]


def group_at(g, r, c):
    color = g[r][c]
    seen = {(r, c)}
    stack = [(r, c)]
    while stack:
        cr, cc = stack.pop()
        for nr, nc in neighbors(cr, cc):
            if g[nr][nc] == color and (nr, nc) not in seen:
                seen.add((nr, nc))
                stack.append((nr, nc))
    return seen


def liberties_of(g, group):
    libs = set()
    for (r, c) in group:
        for nr, nc in neighbors(r, c):
            if g[nr][nc] == ".":
                libs.add((nr, nc))
    return libs


def place_stone(g, r, c, color):
    """Return a copy with `color` placed at (r,c) and any captured enemies removed."""
    ng = clone(g)
    ng[r][c] = color
    enemy = "W" if color == "B" else "B"
    for nr, nc in neighbors(r, c):
        if ng[nr][nc] == enemy:
            grp = group_at(ng, nr, nc)
            if not liberties_of(ng, grp):
                for gr, gc in grp:
                    ng[gr][gc] = "."
    return ng


def is_legal(g, r, c, color="B"):
    if not in_board(r, c) or g[r][c] != ".":
        return False
    ng = place_stone(g, r, c, color)
    return bool(liberties_of(ng, group_at(ng, r, c)))


def all_black_groups_alive(g):
    """Reject boards where a placed black stone is already breathless (illegal)."""
    seen = set()
    for r in range(SIZE):
        for c in range(SIZE):
            if g[r][c] in ("B", "W", "X") and (r, c) not in seen:
                grp = group_at(g, r, c)
                seen |= grp
                if not liberties_of(g, grp):
                    return False
    return True


# ── answer solvers (mirror backend/evaluators) ───────────────────────────
def capturing_moves(g):
    res, seen = set(), set()
    for r in range(SIZE):
        for c in range(SIZE):
            if g[r][c] == "W" and (r, c) not in seen:
                grp = group_at(g, r, c)
                seen |= grp
                libs = liberties_of(g, grp)
                if len(libs) == 1:
                    lr, lc = next(iter(libs))
                    res.add(coord(lr, lc))
    return res


def no_entry_points(g, player="B"):
    opp = "W" if player == "B" else "B"
    res = set()
    for r in range(SIZE):
        for c in range(SIZE):
            if g[r][c] != ".":
                continue
            nbrs = neighbors(r, c)
            if any(g[nr][nc] == "." for nr, nc in nbrs):
                continue
            captures = friendly = False
            for nr, nc in nbrs:
                col = g[nr][nc]
                if col == opp and liberties_of(g, group_at(g, nr, nc)) == {(r, c)}:
                    captures = True
                    break
                if col == player and liberties_of(g, group_at(g, nr, nc)) - {(r, c)}:
                    friendly = True
            if not captures and not friendly:
                res.add(coord(r, c))
    return res


def atari_moves(g, player="B"):
    opp = "W" if player == "B" else "B"
    res = set()
    for r in range(SIZE):
        for c in range(SIZE):
            if g[r][c] != "." or not is_legal(g, r, c, player):
                continue
            ng = place_stone(g, r, c, player)
            seen = set()
            for nr, nc in neighbors(r, c):
                if ng[nr][nc] == opp and (nr, nc) not in seen:
                    grp = group_at(ng, nr, nc)
                    seen |= grp
                    if len(liberties_of(ng, grp)) == 1:
                        res.add(coord(r, c))
    return res


def escape_moves(g, player="B"):
    res, seen = set(), set()
    for r in range(SIZE):
        for c in range(SIZE):
            if g[r][c] == player and (r, c) not in seen:
                grp = group_at(g, r, c)
                seen |= grp
                libs = liberties_of(g, grp)
                if len(libs) != 1:
                    continue
                lr, lc = next(iter(libs))
                if not is_legal(g, lr, lc, player):
                    continue
                ng = place_stone(g, lr, lc, player)
                if len(liberties_of(ng, group_at(ng, lr, lc))) >= 2:
                    res.add(coord(lr, lc))
    return res


def connect_moves(g, player="B"):
    res = set()
    for r in range(SIZE):
        for c in range(SIZE):
            if g[r][c] != ".":
                continue
            groups = {frozenset(group_at(g, nr, nc)) for nr, nc in neighbors(r, c) if g[nr][nc] == player}
            if len(groups) >= 2 and is_legal(g, r, c, player):
                res.add(coord(r, c))
    return res


def cut_moves(g, player="B"):
    opp = "W" if player == "B" else "B"
    res = set()
    for r in range(SIZE):
        for c in range(SIZE):
            if g[r][c] != ".":
                continue
            groups = {frozenset(group_at(g, nr, nc)) for nr, nc in neighbors(r, c) if g[nr][nc] == opp}
            if len(groups) >= 2 and is_legal(g, r, c, player):
                res.add(coord(r, c))
    return res


def black_territory(g):
    seen, total = set(), 0
    for r in range(SIZE):
        for c in range(SIZE):
            if g[r][c] == "." and (r, c) not in seen:
                stack, region, border = [(r, c)], {(r, c)}, set()
                seen.add((r, c))
                while stack:
                    cr, cc = stack.pop()
                    for nr, nc in neighbors(cr, cc):
                        if g[nr][nc] == ".":
                            if (nr, nc) not in seen:
                                seen.add((nr, nc))
                                region.add((nr, nc))
                                stack.append((nr, nc))
                        else:
                            border.add(g[nr][nc])
                if border == {"B"}:
                    total += len(region)
    return total


# ── helpers ───────────────────────────────────────────────────────────────
def grown_group(seed, max_size):
    cells = [seed]
    while len(cells) < max_size:
        r, c = random.choice(cells)
        opts = [(nr, nc) for nr, nc in neighbors(r, c) if (nr, nc) not in cells]
        if not opts:
            break
        cells.append(random.choice(opts))
    return cells


def sprinkle(g, kinds, count):
    empties = [(r, c) for r in range(SIZE) for c in range(SIZE) if g[r][c] == "."]
    random.shuffle(empties)
    for (r, c) in empties[:count]:
        g[r][c] = random.choice(kinds)


# ── per-type builders (each returns puzzle dict or None) ──────────────────
def build_liberties():
    g = empty_grid()
    for (r, c) in grown_group((random.randrange(SIZE), random.randrange(SIZE)), random.choice([1, 1, 2, 2, 3])):
        g[r][c] = "X"
    sprinkle(g, ["W"], random.randint(0, 4))
    xs = [(r, c) for r in range(SIZE) for c in range(SIZE) if g[r][c] == "X"]
    libs = set()
    for (r, c) in xs:
        for nr, nc in neighbors(r, c):
            if g[nr][nc] == ".":
                libs.add((nr, nc))
    n = len(libs)
    if not (1 <= n <= 4) or not all_black_groups_alive(g):
        return None
    return {
        "board": to_strings(g),
        "question": "數數看，被標記（黃色記號）的棋串有幾口氣？",
        "expectedAnswer": str(n),
        "explanation": f"被標記的棋串上下左右共有 {n} 個相鄰的空點，所以是 {n} 口氣。",
    }


def build_capture():
    g = empty_grid()
    wcells = grown_group((random.randrange(SIZE), random.randrange(SIZE)), random.choice([1, 1, 2]))
    for (r, c) in wcells:
        g[r][c] = "W"
    border = list({(nr, nc) for (r, c) in wcells for nr, nc in neighbors(r, c) if (nr, nc) not in set(wcells)})
    if len(border) < 1:
        return None
    random.shuffle(border)
    liberty = border[0]
    for (r, c) in border[1:]:
        g[r][c] = "B"
    caps = capturing_moves(g)
    if coord(*liberty) not in caps or not all_black_groups_alive(g):
        return None
    ans = coord(*liberty)
    captured = len(wcells)
    return {
        "board": to_strings(g),
        "question": "黑棋下在哪裡可以把白棋提走？（輸入座標，例如 C3）",
        "expectedAnswer": ans,
        "acceptableAnswers": sorted(caps),
        "explanation": f"白棋只剩下 {ans} 這一口氣，黑棋下在 {ans} 就能把這 {captured} 顆白棋提走。",
    }


def build_no_entry():
    g = empty_grid()
    r, c = random.randrange(SIZE), random.randrange(SIZE)
    for (nr, nc) in neighbors(r, c):
        g[nr][nc] = "W"
    sprinkle(g, ["W"], random.randint(0, 2))
    ne = no_entry_points(g)
    if coord(r, c) not in ne or not all_black_groups_alive(g):
        return None
    ans = coord(r, c)
    return {
        "board": to_strings(g),
        "question": "哪一個點是黑棋的禁入點（不能下的位置）？（輸入座標）",
        "expectedAnswer": ans,
        "acceptableAnswers": sorted(ne),
        "explanation": f"{ans} 四周都被白棋包住，黑棋下在這裡會立刻沒有氣、又提不到白棋，所以是禁入點。",
    }


def build_territory():
    g = empty_grid()
    corner = random.choice([(0, 0), (0, SIZE - 1), (SIZE - 1, 0), (SIZE - 1, SIZE - 1)])
    region = grown_group(corner, random.choice([1, 2, 3, 4]))
    region_set = set(region)
    for (r, c) in region:
        for nr, nc in neighbors(r, c):
            if (nr, nc) not in region_set:
                g[nr][nc] = "B"
    sprinkle(g, ["W"], random.randint(1, 2))
    n = black_territory(g)
    if not (1 <= n <= 8) or not all_black_groups_alive(g):
        return None
    return {
        "board": to_strings(g),
        "question": "數數看，被黑棋圍住的空點（目）共有幾目？",
        "expectedAnswer": str(n),
        "explanation": f"被黑棋完全圍住、碰不到白棋的空點共有 {n} 個，所以是 {n} 目。",
    }


def build_atari():
    g = empty_grid()
    wcells = grown_group((random.randrange(SIZE), random.randrange(SIZE)), random.choice([1, 1, 2]))
    for (r, c) in wcells:
        g[r][c] = "W"
    border = list({(nr, nc) for (r, c) in wcells for nr, nc in neighbors(r, c) if (nr, nc) not in set(wcells)})
    if len(border) < 2:
        return None
    random.shuffle(border)
    for (r, c) in border[2:]:
        g[r][c] = "B"
    am = atari_moves(g)
    if not am or not all_black_groups_alive(g):
        return None
    ans = sorted(am)[0]
    return {
        "board": to_strings(g),
        "question": "黑棋下在哪裡可以叫吃白棋（讓白棋只剩一口氣）？（輸入座標）",
        "expectedAnswer": ans,
        "acceptableAnswers": sorted(am),
        "explanation": f"白棋現在有兩口氣，黑棋下在 {ans} 就能把它逼到只剩一口氣（叫吃）。",
    }


def build_escape():
    g = empty_grid()
    r, c = random.randrange(SIZE), random.randrange(SIZE)
    g[r][c] = "B"
    nbrs = neighbors(r, c)
    if len(nbrs) < 2:
        return None
    random.shuffle(nbrs)
    for (nr, nc) in nbrs[1:]:
        g[nr][nc] = "W"
    esc = escape_moves(g)
    if not esc or not all_black_groups_alive(g):
        return None
    ans = sorted(esc)[0]
    return {
        "board": to_strings(g),
        "question": "黑棋被叫吃了，下在哪裡可以逃出去（增加氣）？（輸入座標）",
        "expectedAnswer": ans,
        "acceptableAnswers": sorted(esc),
        "explanation": f"黑棋只剩一口氣，下在 {ans} 往外延伸就能長出更多氣逃走。",
    }


def build_connect():
    g = empty_grid()
    r, c = random.randrange(SIZE), random.randrange(SIZE)
    nbrs = neighbors(r, c)
    if len(nbrs) < 2:
        return None
    random.shuffle(nbrs)
    (ar, ac), (br, bc) = nbrs[0], nbrs[1]
    g[ar][ac] = "B"
    g[br][bc] = "B"
    for seed in ((ar, ac), (br, bc)):
        if random.random() < 0.5:
            opts = [(nr, nc) for nr, nc in neighbors(*seed) if g[nr][nc] == "." and (nr, nc) != (r, c)]
            if opts:
                gr, gc = random.choice(opts)
                g[gr][gc] = "B"
    cm = connect_moves(g)
    if coord(r, c) not in cm or not all_black_groups_alive(g):
        return None
    ans = coord(r, c)
    return {
        "board": to_strings(g),
        "question": "黑棋下在哪裡可以把分開的兩塊黑棋連接起來？（輸入座標）",
        "expectedAnswer": ans,
        "acceptableAnswers": sorted(cm),
        "explanation": f"{ans} 的兩邊各有一塊黑棋，下在 {ans} 就能把它們連成一塊、更難被吃。",
    }


def build_cut():
    g = empty_grid()
    r, c = random.randrange(SIZE), random.randrange(SIZE)
    nbrs = neighbors(r, c)
    if len(nbrs) < 2:
        return None
    random.shuffle(nbrs)
    (ar, ac), (br, bc) = nbrs[0], nbrs[1]
    g[ar][ac] = "W"
    g[br][bc] = "W"
    for seed in ((ar, ac), (br, bc)):
        if random.random() < 0.5:
            opts = [(nr, nc) for nr, nc in neighbors(*seed) if g[nr][nc] == "." and (nr, nc) != (r, c)]
            if opts:
                gr, gc = random.choice(opts)
                g[gr][gc] = "W"
    cm = cut_moves(g)
    if coord(r, c) not in cm or not all_black_groups_alive(g):
        return None
    ans = coord(r, c)
    return {
        "board": to_strings(g),
        "question": "黑棋下在哪裡可以把白棋分斷（不讓它們連起來）？（輸入座標）",
        "expectedAnswer": ans,
        "acceptableAnswers": sorted(cm),
        "explanation": f"白棋想在 {ans} 連接，黑棋搶先下在 {ans} 就能把白棋分成兩塊。",
    }


BUILDERS = {
    "GoCountLiberties": build_liberties,
    "GoCaptureStones": build_capture,
    "GoNoEntry": build_no_entry,
    "GoCountTerritory": build_territory,
    "GoKo": build_atari,
    "GoEscape": build_escape,
    "GoConnect": build_connect,
    "GoCut": build_cut,
}


def main():
    random.seed(20260707)
    bank = {}
    for component, builder in BUILDERS.items():
        seen_boards = set()
        puzzles = []
        attempts = 0
        while len(puzzles) < TARGET_PER_TYPE and attempts < 200_000:
            attempts += 1
            puzzle = builder()
            if not puzzle:
                continue
            key = "|".join(puzzle["board"])
            if key in seen_boards:
                continue
            seen_boards.add(key)
            puzzles.append(puzzle)
        bank[component] = puzzles
        print(f"{component:20s} {len(puzzles):3d} puzzles  ({attempts} attempts)")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT_PATH}")


if __name__ == "__main__":
    main()
