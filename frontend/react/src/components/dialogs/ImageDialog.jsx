import { Box, Modal, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

function ImageDialog({ open, onClose, imgUrl }) {
    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "90vw",
                    height: "90vh",
                    outline: "none",
                }}
            >
                <IconButton
                    onClick={onClose}
                    sx={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        color: "white",
                        backgroundColor: "rgba(0,0,0,0.5)",
                        "&:hover": {
                            backgroundColor: "rgba(0,0,0,0.7)",
                        },
                        zIndex: 10,
                    }}
                >
                    <CloseIcon />
                </IconButton>

                <Box
                    component="img"
                    src={imgUrl}
                    sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        borderRadius: 1,
                    }}
                />
            </Box>
        </Modal>
    );
}

export default ImageDialog;
