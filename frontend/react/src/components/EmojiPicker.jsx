import React, { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Popper, ClickAwayListener } from '@mui/material';
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import EmojiPickerReact from 'emoji-picker-react';

const EmojiPicker = ({ 
  onSelect, 
  onClose,
  anchorEl = null,
  placement = 'top-start',
  width = 350,
  height = 400
}) => {
  const [open, setOpen] = useState(true);

  const handleEmojiClick = (emojiData) => {
    onSelect(emojiData.emoji);
    setOpen(false);
    onClose?.();
  };

  const handleClickAway = () => {
    setOpen(false);
    onClose?.();
  };

  useEffect(() => {
    setOpen(true);
  }, []);

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement={placement}
      style={{ zIndex: 9999 }}
      modifiers={[
        {
          name: 'offset',
          options: {
            offset: [0, 10],
          },
        },
      ]}
    >
      <ClickAwayListener onClickAway={handleClickAway}>
        <Box sx={{ 
          bgcolor: 'background.paper', 
          borderRadius: '12px',
          boxShadow: 3,
          overflow: 'hidden'
        }}>
          <EmojiPickerReact
            onEmojiClick={handleEmojiClick}
            width={width}
            height={height}
            theme="light"
            previewConfig={{
              showPreview: false
            }}
            searchPlaceholder="Search emojis..."
            skinTonesDisabled
          />
        </Box>
      </ClickAwayListener>
    </Popper>
  );
};

export default EmojiPicker;