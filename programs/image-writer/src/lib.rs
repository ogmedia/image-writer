use anchor_lang::{
    prelude::*,
    Discriminator,
};
// use anchor_lang::Discriminator;
use anchor_lang::solana_program::msg;
mod state;
use state::{Image, ImageProcessor};

declare_id!("8butU6ZgzAubbaXisbsGPc5sZF9FagNuuNZYepiKLtxi");

#[program]
pub mod image_writer {

    use super::*;

    pub fn initialize(ctx: Context<InitProcessing>, seed_key: Pubkey, total_bytes: u16, chunk_size: u16) -> Result<()> {
        let processor = &mut ctx.accounts.processor;
        let image = &mut ctx.accounts.image.load_init()?;

        // initialize the processor
        processor.init(
            *ctx.bumps.get("processor").unwrap(),
            seed_key,
            ctx.accounts.owner.key(),
            ctx.accounts.image.key(),
            total_bytes,
            chunk_size,
        )?;

        image.owner =  ctx.accounts.owner.key();
        image.raw_byte_length =  total_bytes;
        image.image_type =  state::ImageType::UNKNOWN;
        Ok(())
    }

    pub fn process(ctx: Context<Process>, chunk: Vec<u8>) -> Result<()>{
        let processor = &mut ctx.accounts.processor;
        let image = &mut ctx.accounts.image.load_mut()?;
        
        let last_chunk = usize::try_from(processor.last_chunk).unwrap();
        let chunk_size = chunk.len();
        // copy in new chunk into image data slice
        image.data[last_chunk..last_chunk + chunk_size].copy_from_slice(&chunk);

        processor.last_chunk = processor.last_chunk.checked_add(u16::try_from(chunk.len()).unwrap()).unwrap();
        Ok(())
    }

    pub fn transfer(ctx: Context<Transfer>) -> Result<()>{
        Ok(())
    }
}


#[derive(Accounts)]
#[instruction(seed_key: Pubkey, total_bytes: u16, chunk_size: u16)]
pub struct InitProcessing<'info>{
    #[account(
        init,
        payer = owner,
        seeds = [
            b"image",
            seed_key.as_ref(),
            b"processor",
        ],
        space = ImageProcessor::MAX_SIZE,
        bump,
    )]
    pub processor: Account<'info, ImageProcessor>,

    #[account(signer, zero)]
    /// CHECK: Raw zeroed account
    pub image: AccountLoader<'info, Image>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(chunk: Vec<u8>)]
pub struct Process<'info>{
    #[account(
        mut,
        seeds = [
            b"image",
            processor.seed_key.as_ref(),
            b"processor",
        ],
        bump = processor.bump
    )]
    pub processor: Account<'info, ImageProcessor>,

    #[account(mut,signer)]
    /// CHECK: Will check in function
    pub image: AccountLoader<'info, Image>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct Transfer<'info>{
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: the new owner
    pub new_owner: AccountInfo<'info>,
}
