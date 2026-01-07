import { Box, Typography, Avatar, Chip } from '@mui/material';
import { DiaryCard } from './DairyCard';
import { formatCambodiaDate } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';

function ParentDiaryComponent({ parent, friends, profile }) {
    if (!parent) return null;

    const { t } = useTranslation();

    const combinedMedia = [
        ...(parent.images || []).map((src) => ({
            type: 'image',
            src
        })),
        ...(parent.videos || []).map((src) => ({
            type: 'video',
            src,
            thumbnail: getVideoThumbnail(src, parent)
        }))
    ];

    const visibleMedia = combinedMedia.slice(0, 6);

    const isFriend = (authorId) =>
        friends?.some(
            f =>
                f.status === 'accepted' &&
                (f.user.id === authorId || f.friend.id === authorId)
        );

    const isRequesting = (authorId) =>
        friends?.some(
            f =>
                f.status === 'pending' &&
                (f.user.id === authorId || f.friend.id === authorId)
        );

    return (
        <Box
            sx={{
                border: 1,
                borderRadius: 2,
                borderColor: 'divider',
                p: { xs: 1, sm: 2 },
            }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar
                        src={parent.author?.avatar_url}
                        alt={parent.author?.username}
                        sx={{
                            width: 40,
                            height: 40,
                            bgcolor: 'primary.light',
                            fontSize: '1.1rem',
                        }}
                    >
                        {parent.author?.username?.charAt(0)?.toUpperCase() || 'U'}
                    </Avatar>

                    <Box>
                        <Typography variant="body1" fontWeight="600" color="green">
                            {parent.author?.username || 'Unknown User'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {formatCambodiaDate(parent.created_at)}
                        </Typography>
                    </Box>
                    {/* Friend Request / Status Chips */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {profile && parent.author?.id !== profile.id && (
                            <>
                                {isFriend(parent.author.id) ? (
                                    <Chip
                                        label="Friend"
                                        color="success"
                                        size="small"
                                        variant="outlined"
                                        sx={{ borderRadius: '16px' }}
                                    />
                                ) : isRequesting(parent.author.id) ? (
                                    <Chip
                                        label="Requesting"
                                        color="warning"
                                        size="small"
                                        variant="outlined"
                                        sx={{ borderRadius: '16px' }}
                                    />
                                ) : (
                                    <Tooltip title={`Add ${parent.author.username} as friend`}>
                                        <Button
                                            size="small"
                                            onClick={() => handleSendFriendRequest(parent.author.id)}
                                            disabled={sendingRequests.has(parent.author.id)}
                                            sx={{
                                                borderRadius: 2,
                                                textTransform: 'none',
                                                fontWeight: 500,
                                                py: 0.5,
                                                minWidth: 0
                                            }}
                                        >
                                            {sendingRequests.has(parent.author.id) ? <CircularProgress sx={{ fontSize: 22 }} /> : <PersonAddIcon sx={{ fontSize: 22 }} />}
                                        </Button>
                                    </Tooltip>
                                )}
                            </>
                        )}

                        {profile && parent.author?.id === profile.id && (
                            <Chip
                                label={t('you')}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ fontSize: '0.75rem', height: 26 }}
                            />
                        )}
                    </Box>

                </Box>

            </Box>
            {combinedMedia.length > 0 && (
                <Box sx={{ my: 1.5 }}>
                    <Box
                        sx={{
                            display: 'grid',
                            gap: 0.5,
                            borderRadius: 2,
                            overflow: 'hidden',
                            gridTemplateColumns: (() => {
                                switch (visibleMedia.length) {
                                    case 1:
                                        return '1fr';
                                    case 2:
                                        return '1fr 1fr';
                                    case 3:
                                        return '2fr 1fr';
                                    default:
                                        return '1fr 1fr';
                                }
                            })(),
                            gridTemplateRows:
                                visibleMedia.length === 3 ? '1fr 1fr' : 'auto',
                        }}
                    >
                        {visibleMedia.slice(0, 4).map((media, index) => {
                            const isLarge =
                                visibleMedia.length === 3 && index === 0;

                            return (
                                <Box
                                    key={index}
                                    onClick={() => handleMediaClick(media.src, media.type)}
                                    sx={{
                                        position: 'relative',
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        bgcolor: '#000',
                                        aspectRatio:
                                            visibleMedia.length === 1
                                                ? '16 / 9'
                                                : '1 / 1',
                                        gridRow: isLarge ? 'span 2' : 'auto',
                                    }}
                                >
                                    {/* Image */}
                                    {media.type === 'image' && (
                                        <Box
                                            component="img"
                                            src={media.src}
                                            alt="feed img"
                                            sx={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                            }}
                                        />
                                    )}

                                    {/* Video */}
                                    {media.type === 'video' && (
                                        <>
                                            <Box
                                                component="img"
                                                src={media.thumbnail}
                                                alt=""
                                                sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                }}
                                            />

                                            {/* Play icon */}
                                            <PlayArrowIcon
                                                sx={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    color: '#fff',
                                                    fontSize: 48,
                                                    opacity: 0.9,
                                                }}
                                            />
                                        </>
                                    )}

                                    {/* +X overlay */}
                                    {index === 3 && combinedMedia.length > 4 && (
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                inset: 0,
                                                bgcolor: 'rgba(0,0,0,0.55)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#fff',
                                                fontSize: 32,
                                                fontWeight: 700,
                                            }}
                                        >
                                            +{combinedMedia.length - 4}
                                        </Box>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>

                </Box>
            )}

            {parent.title && (
                <Typography
                    sx={{
                        mt: 2,
                        fontSize: 18,
                        lineHeight: 1.5,
                    }}
                >
                    {parent.title}
                </Typography>
            )}

            <DiaryCard content={parent.content} />
        </Box>
    )
}

export default ParentDiaryComponent
