-- Tic-Tac-Toe Lua Game for ft_transcendence
-- Board layout
local board = {
  {" ", " ", " "},
  {" ", " ", " "},
  {" ", " ", " "}
}

local current_turn = 1 -- Player 1 starts (X)
local my_symbol = "X"
local opp_symbol = "O"

-- When initialized, player_index is injected by JS (1 or 2)
if player_index == 2 then
  my_symbol = "O"
  opp_symbol = "X"
end

local function draw_board()
  clear_screen()
  
  -- Draw title and player info
  draw_cell(8, 2, "TIC-TAC-TOE MULTIPLAYER", "cyan")
  draw_cell(8, 3, "You are Player " .. player_index .. " (" .. my_symbol .. ")", "green")
  
  if current_turn == player_index then
    draw_cell(8, 4, "YOUR TURN! Click a cell.", "yellow")
  else
    draw_cell(8, 4, "Waiting for opponent...", "red")
  end
  
  -- Draw grid lines (40x20 terminal grid)
  -- Box coords: Col 1: 10-14, Col 2: 16-20, Col 3: 22-26
  -- Rows: Row 1: 6-8, Row 2: 10-12, Row 3: 14-16
  
  -- Draw horizontal lines
  for col = 8, 28 do
    draw_cell(col, 9, "-", "white")
    draw_cell(col, 13, "-", "white")
  end
  
  -- Draw vertical lines
  for row = 5, 17 do
    draw_cell(15, row, "|", "white")
    draw_cell(21, row, "|", "white")
  end
  
  -- Draw cell contents
  local cell_coords = {
    { {12, 7}, {18, 7}, {24, 7} },
    { {12, 11}, {18, 11}, {24, 11} },
    { {12, 15}, {18, 15}, {24, 15} }
  }
  
  for r = 1, 3 do
    for c = 1, 3 do
      local val = board[r][c]
      local coords = cell_coords[r][c]
      local color = "white"
      if val == "X" then color = "green"
      elseif val == "O" then color = "red" end
      draw_cell(coords[1], coords[2], val, color)
    end
  end
end

local function check_winner()
  -- Check rows
  for r = 1, 3 do
    if board[r][1] ~= " " and board[r][1] == board[r][2] and board[r][1] == board[r][3] then
      return board[r][1]
    end
  end
  -- Check cols
  for c = 1, 3 do
    if board[1][c] ~= " " and board[1][c] == board[2][c] and board[1][c] == board[3][c] then
      return board[1][c]
    end
  end
  -- Check diagonals
  if board[1][1] ~= " " and board[1][1] == board[2][2] and board[1][1] == board[3][3] then
    return board[1][1]
  end
  if board[1][3] ~= " " and board[1][3] == board[2][2] and board[1][3] == board[3][1] then
    return board[1][3]
  end
  
  -- Check draw
  local empty = 0
  for r = 1, 3 do
    for c = 1, 3 do
      if board[r][c] == " " then empty = empty + 1 end
    end
  end
  if empty == 0 then return "draw" end
  
  return nil
end

local function check_game_over()
  local win = check_winner()
  if win then
    clear_screen()
    draw_board()
    if win == "draw" then
      draw_cell(8, 19, "GAME OVER - IT'S A DRAW!", "yellow")
    elseif win == my_symbol then
      draw_cell(8, 19, "GAME OVER - YOU WON!", "green")
    else
      draw_cell(8, 19, "GAME OVER - YOU LOST!", "red")
    end
    return true
  end
  return false
end

function on_click(x, y)
  if check_winner() then return end
  if current_turn ~= player_index then return end
  
  -- Map x, y to cell
  local r, c = nil, nil
  if y >= 6 and y <= 8 then r = 1
  elseif y >= 10 and y <= 12 then r = 2
  elseif y >= 14 and y <= 16 then r = 3
  end
  
  if x >= 10 and x <= 14 then c = 1
  elseif x >= 16 and x <= 20 then c = 2
  elseif x >= 22 and x <= 26 then c = 3
  end
  
  if r and c and board[r][c] == " " then
    board[r][c] = my_symbol
    send_message(r .. "," .. c)
    current_turn = (player_index == 1) and 2 or 1
    draw_board()
    check_game_over()
  end
end

function on_network_message(payload)
  local r, c = payload:match("([^,]+),([^,]+)")
  r = tonumber(r)
  c = tonumber(c)
  if r and c then
    board[r][c] = opp_symbol
    current_turn = player_index
    draw_board()
    check_game_over()
  end
end

-- Start game
draw_board()
