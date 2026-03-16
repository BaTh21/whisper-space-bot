import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  DoneAll as DoneAllIcon,
  Done as DoneIcon,
  Edit as EditIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material';
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCambodiaTime } from '../../utils/dateUtils';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import CallIcon from '@mui/icons-material/Call';
import ReplyIcon from '@mui/icons-material/Reply';

import EmojiButton from '../EmojiButton';
import MessageReactions from '../MessageReactions';
import { VoiceMessagePlayer } from '../group/VoiceMessagePlayer';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const ChatMessage = ({
  message,
  isMine,
  onUpdate,
  onDelete,
  onForward,
  profile,
  onAddReaction,
  onRemoveReaction,
  onReply,
  userId
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [reactions, setReactions] = useState(message.reactions || []);
  const [showReactionAnimation, setShowReactionAnimation] = useState(null);
  const { t } = useTranslation();

  const handleMenu = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleEdit = async () => {
    if (!editText.trim() || editText === message.content || !onUpdate) {
      setEditing(false);
      handleClose();
      return;
    }

    setIsEditing(true);

    try {
      await onUpdate(message.id, editText, message.is_temp);
      setEditing(false);
      handleClose();
    } catch (err) {
      console.error('Edit error:', err);
    }

    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.content);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (onDelete) {
      try {
        await onDelete(message.id, message.is_temp);
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
    handleClose();
  };

  const showMenu = true;

  const handleImageError = () => {
    setImageError(true);
  };

  const handleDownloadMedia = async (e) => {
    e.stopPropagation();

    try {
      const response = await fetch(message.content);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      let fileName = message.content.split("/").pop()?.split("?")[0];

      if (!fileName) {
        fileName = `chat-file-${message.id}-${Date.now()}`;
      }

      a.download = fileName;

      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleViewFullImage = (e) => {
    e?.stopPropagation();
    setImageModalOpen(true);
  };

  const retryImageLoad = () => {
    setImageError(false);
  };


  useEffect(() => {
    setReactions(message.reactions || []);
  }, [message.reactions]);

  const handleAddReaction = async (emoji) => {
    if (onAddReaction) {
      try {
        setShowReactionAnimation({
          emoji,
          type: 'add',
          timestamp: Date.now()
        });

        setTimeout(() => {
          setShowReactionAnimation(null);
        }, 1000);

        await onAddReaction(message.id, emoji);

        playReactionSound('add');
      } catch (err) {
        console.error('Failed to add reaction:', err);
      }
    }
  };

  const handleRemoveReaction = async (reactionId) => {
    if (onRemoveReaction) {
      try {
        const reactionToRemove = reactions.find(r => r.id === reactionId);
        if (reactionToRemove) {
          setShowReactionAnimation({
            emoji: reactionToRemove.emoji,
            type: 'remove',
            timestamp: Date.now()
          });

          setTimeout(() => {
            setShowReactionAnimation(null);
          }, 1000);
        }

        await onRemoveReaction(message.id, reactionId);
        playReactionSound('remove');
      } catch (err) {
        console.error('Failed to remove reaction:', err);
      }
    }
  };

  const renderImageContent = () => (
    <Box sx={{ mb: 1, position: 'relative' }}>
      {imageError && (
        <Box
          sx={{
            width: '100%',
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'grey.100',
            borderRadius: '8px',
            border: '1px solid primary.main',
            flexDirection: 'column',
            gap: 1,
            textAlign: isMine ? 'right' : 'left',
            direction: isMine ? 'rtl' : 'ltr',
          }}
        >
          <ImageIcon sx={{ color: 'grey.400', fontSize: 40 }} />
          <Typography variant="body2" color="text.secondary" align="center">
            Failed to load image
          </Typography>
          <Button size="small" variant="outlined" onClick={retryImageLoad}>
            Retry
          </Button>
        </Box>
      )}

      {!imageError && (
        <>
          <img
            src={message.content}
            alt="Chat image"
            onError={handleImageError}
            style={{
              maxWidth: '100%',
              maxHeight: 200,
              borderRadius: '8px',
              cursor: 'pointer',
              objectFit: 'cover',
            }}
            onClick={handleMenu}
          />

          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              gap: 0.5,
              opacity: 0,
              transition: 'opacity 0.2s',
            }}
            className="image-actions"
          >
            <IconButton
              size="small"
              onClick={handleViewFullImage}
              sx={{
                bgcolor: 'rgba(0,0,0,0.7)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' },
              }}
            >
              <RemoveRedEyeIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleDownloadMedia}
              sx={{
                bgcolor: 'rgba(0,0,0,0.7)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' },
              }}
            >
              <SaveAltIcon fontSize="small" />
            </IconButton>
          </Box>
        </>
      )}

      {!message.is_temp && reactions.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 10,
            ...(isMine
              ? { right: 10 }
              : { left: 10 }),
            borderColor: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          }}
          onClick={(e) => { e.stopPropagation() }}
        >
          <MessageReactions
            messageId={message.id}
            reactions={reactions}
            currentUserId={profile?.id}
            onAddReaction={handleAddReaction}
            onRemoveReaction={handleRemoveReaction}
            showAddButton={true}
            size="small"
            isMine={isMine}
          />
        </Box>
      )}
    </Box>
  );

  const renderVoiceContent = () => {

    return (
      <VoiceMessagePlayer
        url={message.content}
        isOwn={isMine}
        messageId={message.id}
        reactions={reactions}
        currentUserId={profile?.id}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
      />

    );
  };

  const renderCallMessage = () => {
    return (
      <Box
        sx={{
          bgcolor: isMine ? 'primary.main' : 'white',
          color: isMine ? 'white' : 'text.primary',
          p: 2,
          borderRadius: 3,
          boxShadow: 1,
          wordBreak: 'break-word',
          transition: 'all 0.2s',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            wordBreak: 'break-word',
            lineHeight: 1.4,
            fontSize: '0.9rem',
            mb: reactions.length > 0 ? 0.5 : 0,
            color: isMine ? 'white' : 'text.primary',
          }}
        >
          {message.content}
        </Typography>

        <Button
          variant="outlined"
          size="small"
          sx={{
            width: '100%',
            mt: 1,
            color: isMine ? 'white' : 'primary.dark',
            borderColor: isMine ? 'white' : 'primary.dark',
            '&:hover': {
              borderColor: isMine ? 'white' : 'primary.dark',
              backgroundColor: isMine ? 'rgba(255,255,255,0.1)' : undefined
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <CallIcon
            sx={{
              fontSize: 18,
              mr: 0.5
            }}
          />
          Call Back
        </Button>
        {!message.is_temp && reactions.length > 0 && (
          <Box
            sx={{
              mt: 0.5,
              pt: 0.5,
              display: 'flex',
              justifyContent: isMine ? 'flex-end' : 'flex-start',
              borderColor: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            }}
            onClick={(e) => { e.stopPropagation() }}
          >
            <MessageReactions
              messageId={message.id}
              reactions={reactions}
              currentUserId={profile?.id}
              onAddReaction={handleAddReaction}
              onRemoveReaction={handleRemoveReaction}
              showAddButton={true}
              size="small"
              isMine={isMine}
            />
          </Box>
        )}
      </Box>
    );
  };

  const renderVideoContent = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef(null);

    const handlePlay = () => {
      if (videoRef.current) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    };

    return (
      <Box
        sx={{
          position: 'relative',
          borderRadius: 2,
          overflow: 'hidden',
          width: '100%',
          maxWidth: 200,
          bgcolor: 'black',
        }}
      >
        <video
          ref={videoRef}
          controls={isPlaying}
          style={{ width: '100%', display: 'block' }}
          onEnded={() => setIsPlaying(false)}
        >
          <source src={message.content} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {!isPlaying && (
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              handlePlay();
            }}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: 'rgba(0,0,0,0.6)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
              borderRadius: '50%',
              width: 60,
              height: 60,
              color: 'white',
            }}
          >
            <PlayArrowIcon sx={{ fontSize: 40 }} />
          </IconButton>
        )}
      </Box>
    );
  };

  const renderFileContent = () => {
    const fileName = message.content
      ? message.content.split('/').pop()
      : 'Download File';

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1,
          bgcolor: isMine ? 'primary.main' : 'grey.100',
          color: isMine ? 'white' : 'black',
          borderRadius: 2,
          cursor: 'pointer',
          maxWidth: 400,
        }}
      >

        <InsertDriveFileIcon sx={{ mr: 1 }} />
        <Typography variant="body2" noWrap onClick={() => window.open(message.content, '_blank')}>
          {fileName}
        </Typography>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        mb: 1,
        px: 1,
        position: 'relative',
      }}
      data-message-id={message.id}
      data-is-unread={!isMine && !message.is_read && !message.is_temp ? "true" : "false"}
      data-is-friend={!isMine ? "true" : "false"}
      data-sender-id={message.sender_id}
    >
      {imageModalOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            bgcolor: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setImageModalOpen(false)}
        >
          <Box
            sx={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton
              sx={{
                position: 'absolute',
                top: -40,
                right: 0,
                color: 'white',
                bgcolor: 'rgba(0,0,0,0.5)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
              }}
              onClick={() => setImageModalOpen(false)}
            >
              <CloseIcon />
            </IconButton>

            <img
              src={message.content}
              alt="Full size chat image"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                borderRadius: '8px',
                objectFit: 'contain',
              }}
            />

            <Box sx={{ position: 'absolute', bottom: -40, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 1 }}>
              <IconButton
                onClick={handleDownloadMedia}
                sx={{
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                }}
              >
                <SaveAltIcon />
              </IconButton>
              {isMine && (
                <IconButton
                  onClick={handleDelete}
                  sx={{
                    color: 'white',
                    bgcolor: 'rgba(244,67,54,0.7)',
                    '&:hover': { bgcolor: 'rgba(244,67,54,0.9)' },
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {!isMine && (
        <Avatar
          src={message?.sender_avatar_url}
          sx={{
            width: 32,
            height: 32,
            mr: 1,
            mt: 'auto',
            fontSize: '0.8rem',
            fontWeight: 'bold',
          }}
        >
          {message.sender_username.charAt(0).toUpperCase() ?? 'P'}
        </Avatar>
      )}

      <Box sx={{ maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
        {!isMine && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, ml: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 'bold', mr: 1 }}
            >
              {message.sender_username}
            </Typography>
          </Box>
        )}

        {editing ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              p: 1.5,
              borderRadius: 3,
              bgcolor: 'background.paper',
              boxShadow: 1,
            }}
          >
            {/* Text input */}
            <TextField
              size="small"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              multiline
              maxRows={4}
              autoFocus
              placeholder={t('edit_message')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleEdit();
                } else if (e.key === 'Escape') {
                  handleCancelEdit();
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.95rem',
                  borderRadius: 2,
                  bgcolor: 'grey.50',
                  '& fieldset': {
                    borderColor: 'divider',
                  },
                  '&:hover fieldset': {
                    borderColor: 'text.secondary',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                    borderWidth: 1,
                  },
                },
              }}
            />

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <EmojiButton
                onSelect={(emoji) => setEditText((prev) => prev + emoji)}
                placement="bottom-start"
                size="small"
                width={300}
                height={350}
              />
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 1,
                }}
              >
                <Button
                  size="small"
                  onClick={handleCancelEdit}
                  color="inherit"
                >
                  {t('cancel')}
                </Button>

                <Button
                  size="small"
                  variant="contained"
                  onClick={handleEdit}
                  disabled={isEditing}
                >
                  {isEditing ? t('saving') : t('save')}
                </Button>
              </Box>
            </Box>
          </Box>

        ) : (
          <Box sx={{ position: 'relative', width: '100%' }}>
            <Box
              className="message-bubble"
              onClick={handleMenu}
            >
              {message.is_forwarded && (
                <Box
                  sx={{
                    bgcolor: "#e8f0fe",
                    py: 1,
                    px: 3,
                    borderRadius: 1,
                    display: 'flex',
                    gap: 1,
                    maxHeight: '10vh',
                    maxWidth: 250,
                    overflow: 'hidden',
                    borderLeft: "3px solid #1a73e8",
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    Forwarded from {message.forwarded_from_id !== userId ?
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.2,
                          alightItems: 'center'
                        }}
                      >
                        <Avatar
                          src={message.original_sender_avatar}
                          alt={message.original_sender || "author image"}
                          sx={{
                            width: 14,
                            height: 14,
                            mt: 0.3,
                            fontSize: 8
                          }}
                        >{message.original_sender.charAt(0).toUpperCase() || "P"}</Avatar>
                        {message.original_sender}
                      </Box>
                      :
                      (" you")}
                  </Typography>
                </Box>
              )}

              {message.reply_preview && (
                <Box
                  sx={{
                    bgcolor: "#e8f0fe",
                    py: 1,
                    px: 3,
                    borderRadius: 1,
                    display: 'flex',
                    gap: 1,
                    maxHeight: '10vh',
                    maxWidth: 250,
                    overflow: 'hidden',
                  }}
                >
                  <Typography variant="body2" sx={{ fontSize: 12, mt: 0.3 }}>
                    Reply to
                  </Typography>
                  <Box
                    sx={{
                      opacity: 0.6,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {message.reply_preview.sender_username}
                    </Typography>

                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {message.reply_preview.message_type === "text" && (
                        message.reply_preview.content
                      )}
                      {message.reply_preview.message_type === "image" && (
                        "Image"
                      )}
                      {message.reply_preview.message_type === "voice" && (
                        "Voice message"
                      )}
                      {message.reply_preview.message_type === "file" && (
                        "File"
                      )}
                    </Typography>

                  </Box>
                </Box>
              )}

              {message.message_type === 'image' ? (
                renderImageContent()
              ) : message.message_type === 'voice' ? (
                renderVoiceContent()
              ) : message.message_type === 'video' ? (
                renderVideoContent()
              ) : message.message_type === 'file' ? (
                renderFileContent()
              ) : message.message_type === 'system' ? (
                renderCallMessage()
              ) : (
                <Box
                  sx={{
                    bgcolor: isMine ? 'primary.main' : 'white',
                    p: 2,
                    borderRadius: 3,
                    boxShadow: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: isMine ? 'white' : 'text.primary',
                      wordBreak: 'break-word',
                      transition: 'all 0.2s',
                      textAlign: isMine ? 'right' : 'left',
                    }}
                  >
                    {message.content}
                  </Typography>
                  {!message.is_temp && reactions.length > 0 && (
                    <Box
                      sx={{
                        mt: 0.5,
                        pt: 0.5,
                        display: 'flex',
                        justifyContent: isMine ? 'flex-end' : 'flex-start',
                        borderColor: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      }}
                      onClick={(e) => { e.stopPropagation() }}
                    >
                      <MessageReactions
                        messageId={message.id}
                        reactions={reactions}
                        currentUserId={profile?.id}
                        onAddReaction={handleAddReaction}
                        onRemoveReaction={handleRemoveReaction}
                        showAddButton={true}
                        size="small"
                        isMine={isMine}
                      />
                    </Box>
                  )}
                </Box>
              )}

              <Box sx={{
                display: 'flex',
                justifyContent: isMine ? 'flex-end' : 'flex-start',
                alignItems: 'center',
                mt: 0.5,
                gap: 0.5,
                alignItems: 'center'
              }}>
                <Typography
                  variant="caption"
                  sx={{
                    opacity: 0.7,
                    fontSize: '0.7rem',
                    lineHeight: 1,
                    color: 'text.secondary',
                    mt: 0.25
                  }}
                >
                  {message.edited_at && message.edited_at !== message.created_at && 'edited at '}
                  {formatCambodiaTime(message.created_at)}
                </Typography>
                {isMine && (
                  message?.seen_by?.length > 0 ?
                    (
                      <Tooltip title={message.seen_by[0]?.username || 'Seen'}>
                        <DoneAllIcon
                          sx={{
                            fontSize: 12,
                            color: 'green',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'scale(1.3)', cursor: 'pointer' },
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Tooltip>
                    ) : (
                      <DoneIcon fontSize="12" />
                    )
                )}
              </Box>

            </Box>
          </Box>
        )}

        {showMenu && (
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'top', horizontal: isMine ? 'left' : 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: isMine ? 'right' : 'left' }}
            PaperProps={{
              sx: {
                borderRadius: '12px',
                zIndex: 9999
              }
            }}
          >
            {(() => {
              const menuItems = [];

              // menuItems.push(
              //   <MenuItem
              //     key="react"
              //   >
              //     <MessageReactions
              //       messageId={message.id}
              //       reactions={reactions}
              //       currentUserId={profile?.id}
              //       onAddReaction={handleAddReaction}
              //       onRemoveReaction={handleRemoveReaction}
              //       showAddButton={true}
              //       size="small"
              //       isMine={isMine}
              //     />
              //   </MenuItem>
              // );

              menuItems.push(
                <MenuItem key="reply" onClick={() => { onReply(); handleClose(); }}>
                  <ReplyIcon fontSize="small" sx={{ mr: 1.5 }} />
                  Reply
                </MenuItem>
              );

              if (message.message_type !== 'system') {
                menuItems.push(
                  <MenuItem key="forward" onClick={() => { onForward(); handleClose(); }}>
                    <ShortcutIcon fontSize="small" sx={{ mr: 1.5 }} />
                    {t('forward')}
                  </MenuItem>,

                );
              }

              if (isMine) {
                if (message.message_type === 'text') {
                  menuItems.push(
                    <MenuItem
                      key="edit"
                      onClick={() => {
                        setEditing(true);
                        setEditText(message.content);
                        handleClose();
                      }}
                    >
                      <EditIcon fontSize="small" sx={{ mr: 1.5 }} />
                      {t('edit')}
                    </MenuItem>
                  );
                }

                if (message.message_type === 'image' || message.message_type === 'video' || message.message_type === 'file') {
                  menuItems.push(
                    <MenuItem key="view-full" onClick={handleViewFullImage}>
                      <RemoveRedEyeIcon fontSize="small" sx={{ mr: 1.5 }} />
                      {t('view_full_image')}
                    </MenuItem>,
                    <MenuItem key="download" onClick={handleDownloadMedia}>
                      <SaveAltIcon fontSize="small" sx={{ mr: 1.5 }} />
                      {t('download_image')}
                    </MenuItem>
                  );
                }

                menuItems.push(
                  <MenuItem
                    key="delete"
                    onClick={handleDelete}
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
                    {t('delete')}
                  </MenuItem>
                );
              }
              return menuItems;
            })()}
          </Menu>
        )}
      </Box>

    </Box>
  );
};

export default ChatMessage;