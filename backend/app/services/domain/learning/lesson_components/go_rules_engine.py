from __future__ import annotations

import re
from typing import Any, Optional, Set, Tuple, List


class GoRulesEngine:
    """A dynamic Go rules engine that supports arbitrary board sizes N x M.
    
    Can parse board formats representing either:
    1. A list of strings (e.g. [".....", ".B.W.", ...])
    2. A structured dictionary with coordinates (e.g. {"size": 9, "black": ["C4"], "white": ["D3"], "marks": []})
    """
    
    def __init__(self, board_data: Any):
        self.rows: int = 0
        self.cols: int = 0
        self.grid: list[list[str]] = []
        self.marks: Set[Tuple[int, int]] = set()
        self._parse_board(board_data)

    def _normalize_row_string(self, value: Any) -> list[str]:
        if isinstance(value, str):
            trimmed = value.strip()
            if not trimmed:
                return []
            if re.search(r"[\s,|]+", trimmed):
                return [token for token in re.split(r"[\s,|]+", trimmed) if token]
            return [char for char in trimmed if char != " "]
        if isinstance(value, list):
            return [str(entry) for entry in value if str(entry)]
        return []

    def _parse_board(self, board_data: Any) -> None:
        if not board_data:
            return

        raw_rows: list[list[str]] = []
        mark_coords: list[str] = []
        size: Optional[int] = None

        # Check if the board is in structured dictionary format
        if isinstance(board_data, dict):
            size = board_data.get("size")
            # If coordinates are listed directly:
            black_coords = board_data.get("black", [])
            white_coords = board_data.get("white", [])
            mark_coords = board_data.get("marks", [])
            
            # If the dict contains a "rows" representation
            if "rows" in board_data and isinstance(board_data["rows"], list):
                raw_rows = [self._normalize_row_string(row) for row in board_data["rows"]]
            elif size is not None:
                # Reconstruct the grid from coordinate lists
                self.rows = size
                self.cols = size
                self.grid = [["." for _ in range(size)] for _ in range(size)]
                
                # Apply coordinates
                for coord in black_coords:
                    r, c = self.coord_to_idx(coord)
                    if self.in_bounds(r, c):
                        self.grid[r][c] = "B"
                for coord in white_coords:
                    r, c = self.coord_to_idx(coord)
                    if self.in_bounds(r, c):
                        self.grid[r][c] = "W"
                for coord in mark_coords:
                    r, c = self.coord_to_idx(coord)
                    if self.in_bounds(r, c):
                        self.marks.add((r, c))
                return

        elif isinstance(board_data, list):
            raw_rows = [self._normalize_row_string(row) for row in board_data]

        if not raw_rows:
            return

        # Pad/align the grid to make it rectangular
        max_cols = max((len(row) for row in raw_rows), default=0)
        self.rows = len(raw_rows)
        self.cols = max_cols
        self.grid = []

        for r, row in enumerate(raw_rows):
            padded_row = []
            for c in range(self.cols):
                cell = row[c] if c < len(row) else "."
                # Handle legacy inline "X" marks representation
                if cell in ("X", "x"):
                    self.marks.add((r, c))
                    padded_row.append("B")  # Internally treat marked stones as player B stones
                else:
                    padded_row.append(cell)
            self.grid.append(padded_row)

        # Apply mark coordinates if structured dict supplied both rows and marks lists
        for coord in mark_coords:
            r, c = self.coord_to_idx(coord)
            if self.in_bounds(r, c):
                self.marks.add((r, c))

    def in_bounds(self, r: int, c: int) -> bool:
        return 0 <= r < self.rows and 0 <= c < self.cols

    def get_neighbors(self, r: int, c: int) -> list[tuple[int, int]]:
        neighbors = []
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if self.in_bounds(nr, nc):
                neighbors.append((nr, nc))
        return neighbors

    def get_coord_str(self, r: int, c: int) -> str:
        """Convert index (r, c) to Go standard coordinate notation, e.g. 'C4'."""
        return f"{chr(65 + c)}{self.rows - r}"

    def coord_to_idx(self, coord: str) -> tuple[int, int]:
        """Convert Go standard coordinate string (e.g. 'C4') to index (r, c)."""
        if not coord or len(coord) < 2:
            return -1, -1
        match = re.match(r"^([A-Z])(\d+)$", coord.strip().upper())
        if not match:
            return -1, -1
        col_letter, row_num = match.groups()
        c = ord(col_letter) - 65
        r = self.rows - int(row_num)
        return r, c

    def get_group(self, start_r: int, start_c: int, grid_override: list[list[str]] | None = None) -> tuple[set[tuple[int, int]], set[tuple[int, int]]]:
        """BFS helper to find a group of connected stones and its liberties.
        
        Returns:
            A tuple of (group_stones_set, liberties_empty_points_set)
        """
        grid = grid_override if grid_override is not None else self.grid
        if not self.in_bounds(start_r, start_c):
            return set(), set()
            
        color = grid[start_r][start_c]
        if color == ".":
            return set(), set()

        group = {(start_r, start_c)}
        queue = [(start_r, start_c)]
        liberties = set()
        visited = {(start_r, start_c)}

        while queue:
            r, c = queue.pop(0)
            for nr, nc in self.get_neighbors(r, c):
                cell = grid[nr][nc]
                if cell == ".":
                    liberties.add((nr, nc))
                elif cell == color and (nr, nc) not in visited:
                    visited.add((nr, nc))
                    group.add((nr, nc))
                    queue.append((nr, nc))
        return group, liberties

    def place_stone_virtual(self, r: int, c: int, color: str) -> list[list[str]]:
        """Return a copy of the grid with a stone placed at (r, c), resolving captures."""
        new_grid = [row[:] for row in self.grid]
        if not self.in_bounds(r, c) or new_grid[r][c] != ".":
            return new_grid
            
        new_grid[r][c] = color
        opponent = "W" if color == "B" else "B"
        
        # Check adjacent opponent groups for captures
        for nr, nc in self.get_neighbors(r, c):
            if new_grid[nr][nc] == opponent:
                opp_group, opp_libs = self.get_group(nr, nc, grid_override=new_grid)
                if not opp_libs:  # Captured!
                    for gr, gc in opp_group:
                        new_grid[gr][gc] = "."
        return new_grid

    # ── Solver Methods ──

    def count_marked_group_liberties(self) -> Optional[int]:
        """Count liberties of the group containing the marked points 'X'."""
        if not self.marks:
            return None
            
        visited = set()
        all_liberties = set()
        for r, c in self.marks:
            if (r, c) in visited:
                continue
            group, libs = self.get_group(r, c)
            visited.update(group)
            all_liberties.update(libs)
            
        return len(all_liberties)

    def find_capturing_moves(self, opponent_color: str = "W") -> list[str]:
        """Find coordinates where player can capture opponent stones."""
        visited = set()
        captures = set()
        
        for r in range(self.rows):
            for c in range(self.cols):
                if self.grid[r][c] == opponent_color and (r, c) not in visited:
                    group, libs = self.get_group(r, c)
                    visited.update(group)
                    if len(libs) == 1:
                        lr, lc = next(iter(libs))
                        captures.add(self.get_coord_str(lr, lc))
        return sorted(list(captures))

    def find_no_entry_points(self, player_color: str = "B") -> list[str]:
        """Find forbidden (suicide) empty coordinates for player."""
        opponent = "W" if player_color == "B" else "B"
        no_entry = set()

        for r in range(self.rows):
            for c in range(self.cols):
                if self.grid[r][c] != ".":
                    continue
                
                nbrs = self.get_neighbors(r, c)
                # If there's an empty neighbor, playing here is always legal (has at least 1 liberty)
                if any(self.grid[nr][nc] == "." for nr, nc in nbrs):
                    continue
                
                # Check virtual placement
                virtual_grid = self.place_stone_virtual(r, c, player_color)
                # Find the liberty of the newly placed stone's group
                _, new_libs = self.get_group(r, c, grid_override=virtual_grid)
                
                if not new_libs:
                    no_entry.add(self.get_coord_str(r, c))
                    
        return sorted(list(no_entry))

    def find_connecting_moves(self, player_color: str = "B") -> list[str]:
        """Find coordinates where playing connects two or more friendly groups."""
        connectors = set()
        for r in range(self.rows):
            for c in range(self.cols):
                if self.grid[r][c] != ".":
                    continue
                
                # Check what groups are adjacent to this point
                adjacent_groups = set()
                for nr, nc in self.get_neighbors(r, c):
                    if self.grid[nr][nc] == player_color:
                        group, _ = self.get_group(nr, nc)
                        adjacent_groups.add(frozenset(group))
                        
                # If it connects 2 or more distinct friendly groups
                if len(adjacent_groups) >= 2:
                    # Verify it's a legal move (not suicide)
                    virtual_grid = self.place_stone_virtual(r, c, player_color)
                    _, libs = self.get_group(r, c, grid_override=virtual_grid)
                    if libs:
                        connectors.add(self.get_coord_str(r, c))
        return sorted(list(connectors))

    def find_cutting_moves(self, player_color: str = "B") -> list[str]:
        """Find coordinates where playing cuts two or more opponent groups."""
        opponent = "W" if player_color == "B" else "B"
        cutters = set()
        for r in range(self.rows):
            for c in range(self.cols):
                if self.grid[r][c] != ".":
                    continue
                
                # Check what opponent groups are adjacent to this point
                adjacent_opp_groups = set()
                for nr, nc in self.get_neighbors(r, c):
                    if self.grid[nr][nc] == opponent:
                        group, _ = self.get_group(nr, nc)
                        adjacent_opp_groups.add(frozenset(group))
                        
                # If it cuts 2 or more distinct opponent groups
                if len(adjacent_opp_groups) >= 2:
                    # Verify it's a legal move for player
                    virtual_grid = self.place_stone_virtual(r, c, player_color)
                    _, libs = self.get_group(r, c, grid_override=virtual_grid)
                    if libs:
                        cutters.add(self.get_coord_str(r, c))
        return sorted(list(cutters))

    def find_escaping_moves(self, player_color: str = "B") -> list[str]:
        """Find coordinates to rescue a friendly group currently in atari."""
        escapes = set()
        for r in range(self.rows):
            for c in range(self.cols):
                if self.grid[r][c] == player_color:
                    group, libs = self.get_group(r, c)
                    if len(libs) == 1:
                        # Friendly group in atari, find its sole liberty point
                        lr, lc = next(iter(libs))
                        # Check if playing there increases its liberties to >= 2
                        virtual_grid = self.place_stone_virtual(lr, lc, player_color)
                        _, new_libs = self.get_group(lr, lc, grid_override=virtual_grid)
                        if len(new_libs) >= 2:
                            escapes.add(self.get_coord_str(lr, lc))
        return sorted(list(escapes))

    def find_atari_moves(self, player_color: str = "B") -> list[str]:
        """Find moves that put an opponent group into atari (reduce liberties to exactly 1)."""
        opponent = "W" if player_color == "B" else "B"
        atari_moves = set()
        
        for r in range(self.rows):
            for c in range(self.cols):
                if self.grid[r][c] != ".":
                    continue
                
                # Check virtual placement
                virtual_grid = self.place_stone_virtual(r, c, player_color)
                # Verify the player move itself is legal
                _, player_libs = self.get_group(r, c, grid_override=virtual_grid)
                if not player_libs:
                    continue
                
                # Check if this move reduced liberties of any adjacent opponent group to 1
                for nr, nc in self.get_neighbors(r, c):
                    if virtual_grid[nr][nc] == opponent:
                        opp_group, opp_libs = self.get_group(nr, nc, grid_override=virtual_grid)
                        if len(opp_libs) == 1:
                            atari_moves.add(self.get_coord_str(r, c))
                            
        return sorted(list(atari_moves))

    def count_black_territory(self) -> int:
        """Count the territory (empty spaces) fully enclosed by Black stones."""
        seen = set()
        total_territory = 0
        
        for r in range(self.rows):
            for c in range(self.cols):
                if self.grid[r][c] == "." and (r, c) not in seen:
                    stack = [(r, c)]
                    region = {(r, c)}
                    seen.add((r, c))
                    borders = set()
                    
                    while stack:
                        cr, cc = stack.pop()
                        for nr, nc in self.get_neighbors(cr, cc):
                            cell = self.grid[nr][nc]
                            if cell == ".":
                                if (nr, nc) not in seen:
                                    seen.add((nr, nc))
                                    region.add((nr, nc))
                                    stack.append((nr, nc))
                            else:
                                borders.add(cell)
                                
                    # If this empty region is enclosed strictly by Black ('B') stones
                    if borders == {"B"}:
                        total_territory += len(region)
                        
        return total_territory

    def find_any_legal_action(self, player_color: str = "B") -> list[str]:
        """Fallback solver: find any legal move for player on the board."""
        legal = []
        for r in range(self.rows):
            for c in range(self.cols):
                if self.grid[r][c] == ".":
                    virtual_grid = self.place_stone_virtual(r, c, player_color)
                    _, libs = self.get_group(r, c, grid_override=virtual_grid)
                    if libs:
                        legal.append(self.get_coord_str(r, c))
        return legal
