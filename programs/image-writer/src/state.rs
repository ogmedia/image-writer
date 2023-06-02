
    use anchor_lang::prelude::*;

    #[account]
    pub struct ImageProcessor {
        pub bump: u8,
        pub owner: Pubkey,
        pub seed_key: Pubkey,
        pub image: Pubkey,
        pub last_chunk: u16,
        pub total_bytes: u16,
        pub chunk_size: u16,
        pub closed: bool
    }

    impl ImageProcessor {
        pub const MAX_SIZE: usize = 8 +
            1 +     // bump
            32 +    // owner
            32 +    // seed_key
            32 +    // image
            2 +     // last_chunk
            2 +     // total_bytes
            2 +     // chunk_size
            1;      // closed

        pub fn init(&mut self, bump: u8, seed_key: Pubkey, owner: Pubkey, image: Pubkey, total_bytes: u16, chunk_size: u16) -> Result<()> {
            self.bump = bump;
            self.owner = owner;
            self.seed_key = seed_key;
            self.image = image;
            self.last_chunk = 0;
            self.total_bytes = total_bytes;
            self.chunk_size = if chunk_size > 0 { chunk_size } else { 500 };
            self.closed = false;
            Ok(())
        }
    }

    #[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Copy)]
    pub enum ImageType {
        PNG,
        JPEG,
        GIF,
        WEBP,
        TIFF,
        BMP,
        ICO,
        PSD,
        SVG,
        HEIF,
        PDF,
        EPS,
        RAW,
        UNKNOWN,
    }

    pub enum ImageSize {
        Small = 10000,
        Default = 40000,
        Large = 100000,
    }

    // #[derive(AnchorSerialize, AnchorDeserialize, Debug)]
    #[account(zero_copy)]
    #[derive(AnchorDeserialize, AnchorSerialize, Debug)]
    pub struct Image{
        // pub bump: u8,
        pub owner: Pubkey,
        pub raw_byte_length: u16,
        pub image_type: ImageType,
        pub data: [u8; 40000],
    }

