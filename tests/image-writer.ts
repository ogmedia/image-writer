import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ImageWriter } from "../target/types/image_writer";
import { createCanvas, loadImage, createImageData, Image } from "canvas";
import { SystemProgram, Transaction } from "@solana/web3.js";
import { expect } from "chai";
import { AnchorProvider } from "@project-serum/anchor";
import * as fs from "fs";
import { PNG } from "pngjs";

const PROGRAM_ID = new anchor.web3.PublicKey(
  "8butU6ZgzAubbaXisbsGPc5sZF9FagNuuNZYepiKLtxi"
);

const getProcessorAddress = async (seedKey: anchor.web3.PublicKey) => {
  const processorAddress = await anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("image"), seedKey.toBuffer(), Buffer.from("processor")],
    PROGRAM_ID
  );
  return processorAddress[0];
};
const getImageAddress = async (seedKey: anchor.web3.PublicKey) => {
  const imageAddress = await anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("image"), seedKey.toBuffer()],
    PROGRAM_ID
  );
  return imageAddress[0];
};

const createTestImage = async (): Promise<Buffer> => {
  const canvas = createCanvas(100, 100);
  const ctx = canvas.getContext("2d");

  let grd = ctx.createLinearGradient(0, 100, 100, 0);
  grd.addColorStop(0, "green");
  grd.addColorStop(1, "purple");

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 100, 100);

  ctx.font = "18px Sans-Serif";
  ctx.fillStyle = "white";
  ctx.fillText("SOLANA", 10, 50);

  return canvas.toBuffer("image/png");
};

let processorPda;
let imagePda;
let seedKey;
let program: Program<ImageWriter>;
let provider;
let testImage: Buffer;
const imageKeypair = anchor.web3.Keypair.generate();
describe("image-writer", async function () {
  this.beforeAll(async function () {
    // Configure the client to use the local cluster.
    provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    program = anchor.workspace.ImageWriter as Program<ImageWriter>;
    try {
      seedKey = anchor.web3.Keypair.generate().publicKey;
      processorPda = await getProcessorAddress(seedKey);
      imagePda = imageKeypair.publicKey;
      testImage = await createTestImage();
    } catch (err) {
      console.log(err);
    }
  });

  describe("Write image to account", async function () {
    it("Is initialized!", async () => {
      console.log("processorPda", processorPda.toBase58());
      console.log("imagePda", imagePda.toBase58());
      console.log("seedKey", seedKey.toBase58());
      console.log("wallet key", provider.wallet.publicKey.toBase58());
      // get the raw bytes of the testImage
      const rawImageData: Uint8Array = Uint8Array.from(testImage);
      const totalBytes = rawImageData.length;
      const chunkSize = 500;

      console.log("running init transaction");
      const space = 40044;

      const lamports =
        await provider.connection.getMinimumBalanceForRentExemption(space);
      console.log("lamports needed", lamports);
      try {
        // rent needed
        const imageInitIx = SystemProgram.createAccount({
          fromPubkey: provider.wallet.publicKey,
          lamports,
          newAccountPubkey: imagePda,
          programId: PROGRAM_ID,
          space,
        });
        // console.log(JSON.stringify(imageInitIx, null, 2));
        console.log("assembling init tx");

        try {
          const initIx = await program.methods
            .initialize(seedKey, totalBytes, chunkSize)
            .accounts({
              processor: processorPda,
              image: imagePda,
              owner: provider.wallet.publicKey,
            })
            .instruction();

          const tx = new Transaction().add(imageInitIx);
          tx.add(initIx);
          const { blockhash, lastValidBlockHeight } =
            await provider.connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;
          tx.lastValidBlockHeight = lastValidBlockHeight;
          tx.feePayer = provider.wallet.publicKey;
          tx.sign(imageKeypair);
          provider.wallet.signTransaction(tx);
          const sig = await provider.sendAndConfirm(tx);
          console.log("Your transaction signature", sig);
        } catch (err) {
          console.log("Error creating/sendind transaction");
          console.log(err);
        }
      } catch (err) {
        console.log(err);
      }
      let processorState = await program.account.imageProcessor.fetch(
        processorPda,
        "processed"
      );
      expect(processorState.owner.equals(provider.wallet.publicKey));
      let imageState = await program.account.image.fetch(imagePda);

      console.log("processor init state");
      console.log(processorState);
      console.log("image init state");
      console.log(imageState);
    });

    it("Can write image data", async () => {
      const rawImageData: Uint8Array = Uint8Array.from(testImage);
      const totalBytes = rawImageData.length;
      console.log("rawImageData", rawImageData);
      console.log("total bytes", totalBytes);
      // to be safe, we can only do 500 bytes at a time, so get the number of chunks
      // including the leftover
      const chunkSize = 500;
      const numberOfChunks = Math.ceil(totalBytes / chunkSize);
      for (let i = 0; i < numberOfChunks; i++) {
        const chunk = rawImageData.slice(
          i * chunkSize,
          i * chunkSize + chunkSize
        );

        const processTx = await program.methods
          .process(Buffer.from(chunk))
          .accounts({
            processor: processorPda,
            image: imagePda,
            owner: provider.wallet.publicKey,
          })
          .transaction();
        const { blockhash, lastValidBlockHeight } =
          await provider.connection.getLatestBlockhash();
        processTx.recentBlockhash = blockhash;
        processTx.lastValidBlockHeight = lastValidBlockHeight;
        processTx.feePayer = provider.wallet.publicKey;

        processTx.sign(imageKeypair);
        try {
          const sig = await provider.sendAndConfirm(processTx);
          console.log("chunk transaction signature", sig);
        } catch (err) {
          console.log("Error sending chunk transaction");
          console.log(err);
          throw err;
        }
      }

      const processorState = await program.account.imageProcessor.fetch(
        processorPda
      );
      const imageState = await program.account.image.fetch(imagePda);

      var png = PNG.sync.read(
        Buffer.from(imageState.data.slice(0, processorState.totalBytes))
      );
      var options = { colorType: 6 };
      var buffer = PNG.sync.write(png, options);
      fs.writeFileSync("test.png", buffer);
    });
  });
});
