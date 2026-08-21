-- Battleship Lua Game for ft_transcendence
-- 2-Phase Game: 1) Ship Placement  2) Battle

local GRID_SIZE = 6
local row_names = {"A", "B", "C", "D", "E", "F"}

-- Player index injected by JS engine (1 or 2)
local p_idx = player_index or 1
local my_symbol = "P" .. p_idx

local phase = "placement" -- "placement" or "battle"
local current_turn = 1    -- Player 1 starts battle

local status_msg = "Place ships on MY FLEET grid."
local game_over = false

local ships_to_place = {
  { name = "Battleship", length = 3 },
  { name = "Cruiser",    length = 2 },
  { name = "Destroyer",  length = 2 }
}
local current_ship_idx = 1
local orientation = "H" -- "H" or "V"

local my_ready = false
local opp_ready = false

-- My fleet board (6x6)
local my_fleet = {
  {".", ".", ".", ".", ".", "."},
  {".", ".", ".", ".", ".", "."},
  {".", ".", ".", ".", ".", "."},
  {".", ".", ".", ".", ".", "."},
  {".", ".", ".", ".", ".", "."},
  {".", ".", ".", ".", ".", "."}
}

-- Target radar board (6x6)
local radar = {
  {".", ".", ".", ".", ".", "."},
  {".", ".", ".", ".", ".", "."},
  {".", ".", ".", ".", ".", "."},
  {".", ".", ".", ".", ".", "."},
  {".", ".", ".", ".", ".", "."},
  {".", ".", ".", ".", ".", "."}
}

local my_ships_left = 7
local hits_scored = 0

local function can_place_ship(r, c, len, orient)
  if orient == "H" then
    if c + len - 1 > GRID_SIZE then return false end
    for i = 0, len - 1 do
      if my_fleet[r][c + i] ~= "." then return false end
    end
  else -- "V"
    if r + len - 1 > GRID_SIZE then return false end
    for i = 0, len - 1 do
      if my_fleet[r + i][c] ~= "." then return false end
    end
  end
  return true
end

local function do_place_ship(r, c, len, orient)
  if orient == "H" then
    for i = 0, len - 1 do
      my_fleet[r][c + i] = "S"
    end
  else
    for i = 0, len - 1 do
      my_fleet[r + i][c] = "S"
    end
  end
end

local function draw_board()
  clear_screen()

  -- Header
  draw_cell(10, 1, "BATTLESHIP 6x6 MULTIPLAYER", "cyan")
  draw_cell(8, 2, "You are Player " .. p_idx .. " (" .. my_symbol .. ")", "green")

  if phase == "placement" then
    if my_ready then
      draw_cell(5, 3, "SETUP READY! Waiting for opponent", "yellow")
    else
      draw_cell(4, 3, "PHASE 1: Place ships on MY FLEET", "yellow")
    end

    -- Left Board (My Fleet)
    draw_cell(5, 4, "MY FLEET", "cyan")
    draw_cell(4, 5, " 1 2 3 4 5 6", "white")
    for r = 1, GRID_SIZE do
      draw_cell(3, 5 + r, row_names[r], "white")
      for c = 1, GRID_SIZE do
        local val = my_fleet[r][c]
        local color = (val == "S") and "green" or "white"
        draw_cell(5 + (c - 1) * 2, 5 + r, val, color)
      end
    end

    -- Divider
    for row = 4, 15 do
      draw_cell(19, row, "|", "white")
    end

    -- Right Control Panel
    draw_cell(23, 4, "FLEET SETUP", "yellow")
    
local c1 = (current_ship_idx == 1 and not my_ready) and "yellow" or (((current_ship_idx > 1) or my_ready) and "green" or "white")
local c2 = (current_ship_idx == 2 and not my_ready) and "yellow" or (((current_ship_idx > 2) or my_ready) and "green" or "white")
local c3 = (current_ship_idx == 3 and not my_ready) and "yellow" or (my_ready and "green" or "white")

    draw_cell(22, 6, "1. Battleship (3)", c1)
    draw_cell(22, 7, "2. Cruiser    (2)", c2)
    draw_cell(22, 8, "3. Destroyer  (2)", c3)

    if my_ready then
      draw_cell(22, 10, "Status: READY [v]", "green")
    else
      local curr_name = ships_to_place[current_ship_idx].name
      local curr_len = ships_to_place[current_ship_idx].length
      draw_cell(21, 10, "Placing: " .. curr_name .. " (" .. curr_len .. ")", "yellow")
    end

    -- Buttons
    draw_cell(22, 12, "[ ROTATE: " .. (orientation == "H" and "Horiz" or "Vert") .. " ]", "cyan")
    draw_cell(22, 14, "[ RESET FLEET ]", "red")

    draw_cell(2, 16, "STATUS: " .. status_msg, "yellow")

  else -- phase == "battle"
    if game_over then
      -- Banner rendered by end state
    elseif current_turn == p_idx then
      draw_cell(5, 3, "YOUR TURN! Click Target Radar", "yellow")
    else
      draw_cell(8, 3, "Waiting for opponent move...", "red")
    end

    -- Left Board (My Fleet)
    draw_cell(5, 4, "MY FLEET", "cyan")
    draw_cell(4, 5, " 1 2 3 4 5 6", "white")
    for r = 1, GRID_SIZE do
      draw_cell(3, 5 + r, row_names[r], "white")
      for c = 1, GRID_SIZE do
        local val = my_fleet[r][c]
        local color = "white"
        if val == "S" then color = "green"
        elseif val == "X" then color = "red"
        elseif val == "O" then color = "cyan" end
        draw_cell(5 + (c - 1) * 2, 5 + r, val, color)
      end
    end

    -- Divider
    for row = 4, 15 do
      draw_cell(19, row, "|", "white")
    end

    -- Right Board (Target Radar)
    draw_cell(23, 4, "TARGET RADAR", "yellow")
    draw_cell(24, 5, " 1 2 3 4 5 6", "white")
    for r = 1, GRID_SIZE do
      draw_cell(23, 5 + r, row_names[r], "white")
      for c = 1, GRID_SIZE do
        local val = radar[r][c]
        local color = "white"
        if val == "X" then color = "red"
        elseif val == "O" then color = "cyan" end
        draw_cell(25 + (c - 1) * 2, 5 + r, val, color)
      end
    end

    -- Footer Stats & Legend
    draw_cell(2, 13, "LEGEND: S = Ship  X = Hit  O = Miss", "white")
    draw_cell(2, 14, "Fleet Floating: " .. my_ships_left .. "/7", "green")
    draw_cell(22, 14, "Hits Scored: " .. hits_scored .. "/7", "yellow")

    draw_cell(2, 16, "STATUS: " .. status_msg, "yellow")
  end
end

function on_click(x, y)
  if game_over then return end

  if phase == "placement" then
    -- Check button clicks on Right Panel (x: 21..39)
    if y == 12 and x >= 21 and x <= 39 then
      orientation = (orientation == "H") and "V" or "H"
      status_msg = "Orientation set to " .. (orientation == "H" and "Horizontal." or "Vertical.")
      draw_board()
      return
    end

    if y == 14 and x >= 21 and x <= 39 then
      my_fleet = {
        {".", ".", ".", ".", ".", "."},
        {".", ".", ".", ".", ".", "."},
        {".", ".", ".", ".", ".", "."},
        {".", ".", ".", ".", ".", "."},
        {".", ".", ".", ".", ".", "."},
        {".", ".", ".", ".", ".", "."}
      }
      current_ship_idx = 1
      if my_ready then
        my_ready = false
        send_message("unready")
      end
      status_msg = "Fleet reset! Place ships again."
      draw_board()
      return
    end

    -- Check click on Left Fleet Grid (x: 4..16, y: 6..11)
    if not my_ready and y >= 6 and y <= 11 and x >= 4 and x <= 16 then
      local r = y - 5
      local c = math.floor((x - 4) / 2) + 1

      if r >= 1 and r <= 6 and c >= 1 and c <= 6 then
        local ship = ships_to_place[current_ship_idx]
        if can_place_ship(r, c, ship.length, orientation) then
          do_place_ship(r, c, ship.length, orientation)
          current_ship_idx = current_ship_idx + 1

          if current_ship_idx > #ships_to_place then
            my_ready = true
            send_message("ready")
            if opp_ready then
              phase = "battle"
              status_msg = "Both ready! BATTLE BEGINS!"
            else
              status_msg = "Ships set! Waiting for enemy."
            end
          else
            status_msg = "Placed " .. ship.name .. ". Next: " .. ships_to_place[current_ship_idx].name
          end
        else
          status_msg = "Cannot place ship there."
        end
        draw_board()
      end
    end

  else -- phase == "battle"
    if current_turn ~= p_idx then return end

    -- Check click on Target Radar (x: 24..35, y: 6..11)
    if y >= 6 and y <= 11 and x >= 24 and x <= 35 then
      local r = y - 5
      local c = math.floor((x - 24) / 2) + 1

      if r >= 1 and r <= 6 and c >= 1 and c <= 6 then
        if radar[r][c] ~= "." then
          status_msg = "Already shot at " .. row_names[r] .. c .. "! Try another."
          draw_board()
          return
        end

        radar[r][c] = "?"
        status_msg = "Firing at " .. row_names[r] .. c .. "..."
        send_message("fire:" .. r .. "," .. c)

        current_turn = (p_idx == 1) and 2 or 1
        draw_board()
      end
    end
  end
end

function on_network_message(payload)
  if game_over then return end

  if payload == "ready" then
    opp_ready = true
    if my_ready then
      phase = "battle"
      status_msg = "Both fleets ready! BATTLE BEGINS!"
    else
      status_msg = "Opponent ready! Finish placement."
    end
    draw_board()
    return
  elseif payload == "unready" then
    opp_ready = false
    status_msg = "Opponent adjusting fleet setup."
    draw_board()
    return
  end

  if phase ~= "battle" then return end

  if payload:find("^fire:") then
    local r, c = payload:match("^fire:(%d+),(%d+)")
    r = tonumber(r)
    c = tonumber(c)
    if r and c and r >= 1 and r <= GRID_SIZE and c >= 1 and c <= GRID_SIZE then
      local cell = my_fleet[r][c]
      if cell == "S" then
        my_fleet[r][c] = "X"
        my_ships_left = my_ships_left - 1
        status_msg = "ENEMY HIT your ship at " .. row_names[r] .. c .. "!"
        send_message("res:" .. r .. "," .. c .. ":H")

        if my_ships_left == 0 then
          game_over = true
          current_turn = 0
          draw_board()
          draw_cell(5, 18, "GAME OVER - ALL YOUR SHIPS SUNK!", "red")
          send_message("game_over:" .. ((p_idx == 1) and 2 or 1))
          return
        end
      elseif cell == "." then
        my_fleet[r][c] = "O"
        status_msg = "Enemy missed at " .. row_names[r] .. c .. "."
        send_message("res:" .. r .. "," .. c .. ":M")
      elseif cell == "X" then
        status_msg = "Enemy fired again at " .. row_names[r] .. c .. " (already hit)."
        send_message("res:" .. r .. "," .. c .. ":H")
      elseif cell == "O" then
        status_msg = "Enemy fired again at " .. row_names[r] .. c .. " (already missed)."
        send_message("res:" .. r .. "," .. c .. ":M")
      end

      current_turn = p_idx
      draw_board()
    end

  elseif payload:find("^res:") then
    local r, c, res_type = payload:match("^res:(%d+),(%d+):([HM])")
    r = tonumber(r)
    c = tonumber(c)
    if r and c and r >= 1 and r <= GRID_SIZE and c >= 1 and c <= GRID_SIZE then
      if res_type == "H" then
        radar[r][c] = "X"
        hits_scored = hits_scored + 1
        status_msg = "DIRECT HIT at " .. row_names[r] .. c .. "!"

        if hits_scored == 7 then
          game_over = true
          current_turn = 0
          draw_board()
          draw_cell(3, 18, "VICTORY! ALL ENEMY SHIPS DESTROYED!", "green")
          send_message("game_over:" .. p_idx)
          return
        end
      else
        radar[r][c] = "O"
        status_msg = "Shot missed at " .. row_names[r] .. c .. "."
      end

      current_turn = (p_idx == 1) and 2 or 1
      draw_board()
    end
  end
end

-- Start game
draw_board()
