import {
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    clusterApiUrl,
    sendAndConfirmTransaction,
  } from "@solana/web3.js";
  import {
    ExtensionType,
    TOKEN_2022_PROGRAM_ID,
    createInitializeMintInstruction,
    getMintLen,
    createInitializeMetadataPointerInstruction,
    getMint,
    getMetadataPointerState,
    getTokenMetadata,
    TYPE_SIZE,
    LENGTH_SIZE,
    mintTo,
    getOrCreateAssociatedTokenAccount,
    getAccount,
  } from "@solana/spl-token";
  import {
    createInitializeInstruction,
    createUpdateFieldInstruction,
    createRemoveKeyInstruction,
    pack,
    TokenMetadata,
  } from "@solana/spl-token-metadata";
   
  // Playground wallet
  const payer = Keypair.fromSecretKey(Uint8Array.from(
    [
...
     ]
  ));
   
  // Connection to devnet cluster
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
   
  // Transaction to send
  let transaction: Transaction;
  // Transaction signature returned from sent transaction
  let transactionSignature: string;
  
  // Generate new keypair for Mint Account
  const mintKeypair = Keypair.generate();
  // Address for Mint Account
  const mint = mintKeypair.publicKey;
  // Decimals for Mint Account
  const decimals = 2;
  // Authority that can mint new tokens
  const mintAuthority = payer.publicKey;
  // Authority that can update the metadata pointer and token metadata
  const updateAuthority = payer.publicKey;
   
  // Metadata to store in Mint Account
  const metaData: TokenMetadata = {
    updateAuthority: updateAuthority,
    mint: mint,
    name: "ArtScienceTest",
    symbol: "ASRTEST",
    uri: "https://raw.githubusercontent.com/DangerousPotential/solana-token-metadata/refs/heads/main/metadata.json",
    additionalMetadata: [["description", "Only Possible On Solana"]],
  };
  
  // Size of MetadataExtension 2 bytes for type, 2 bytes for length
  const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
  // Size of metadata
  const metadataLen = pack(metaData).length;
   
  // Size of Mint Account with extension
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
   
  // Minimum lamports required for Mint Account
  const lamports = await connection.getMinimumBalanceForRentExemption(
    mintLen + metadataExtension + metadataLen,
  );
  
  // Instruction to invoke System Program to create new account
  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey, // Account that will transfer lamports to created account
    newAccountPubkey: mint, // Address of the account to create
    space: mintLen, // Amount of bytes to allocate to the created account
    lamports, // Amount of lamports transferred to created account
    programId: TOKEN_2022_PROGRAM_ID, // Program assigned as owner of created account
  });
  
  // Instruction to initialize the MetadataPointer Extension
  const initializeMetadataPointerInstruction =
    createInitializeMetadataPointerInstruction(
      mint, // Mint Account address
      updateAuthority, // Authority that can set the metadata address
      mint, // Account address that holds the metadata
      TOKEN_2022_PROGRAM_ID,
    );
  
  // Instruction to initialize Mint Account data
  const initializeMintInstruction = createInitializeMintInstruction(
    mint, // Mint Account Address
    decimals, // Decimals of Mint
    mintAuthority, // Designated Mint Authority
    null, // Optional Freeze Authority
    TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
  );
  
  // Instruction to initialize Metadata Account data
  const initializeMetadataInstruction = createInitializeInstruction({
    programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
    metadata: mint, // Account address that holds the metadata
    updateAuthority: updateAuthority, // Authority that can update the metadata
    mint: mint, // Mint Account address
    mintAuthority: mintAuthority, // Designated Mint Authority
    name: metaData.name,
    symbol: metaData.symbol,
    uri: metaData.uri,
  });
  
  // Instruction to update metadata, adding custom field
  const updateFieldInstruction = createUpdateFieldInstruction({
    programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
    metadata: mint, // Account address that holds the metadata
    updateAuthority: updateAuthority, // Authority that can update the metadata
    field: metaData.additionalMetadata[0][0], // key
    value: metaData.additionalMetadata[0][1], // value
  });
  
  // Add instructions to new transaction
  transaction = new Transaction().add(
    createAccountInstruction,
    initializeMetadataPointerInstruction,
    // note: the above instructions are required before initializing the mint
    initializeMintInstruction,
    initializeMetadataInstruction,
    updateFieldInstruction,
  );
   
  // Send transaction
  transactionSignature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, mintKeypair], // Signers
  );
   
  console.log(
    "\nCreate Mint Account:",
    `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
  );
  
  // Retrieve mint information
  const mintInfo = await getMint(
    connection,
    mint,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
   
  // Retrieve and log the metadata pointer state
  const metadataPointer = getMetadataPointerState(mintInfo);
  console.log("\nMetadata Pointer:", JSON.stringify(metadataPointer, null, 2));
  
  // Retrieve and log the metadata state
  const metadata = await getTokenMetadata(
    connection,
    mint, // Mint Account address
  );
  console.log("\nMetadata:", JSON.stringify(metadata, null, 2));
  // ... existing imports and code ...

// After metadata state logging, add:
console.log("\nMinting tokens to user wallet...");

// Get the associated token account for the payer
const payerATA = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    false,
    'confirmed',
    TOKEN_2022_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID
);

// Mint tokens to the payer's associated token account
const mintAmount = 1000000000; // 1 billion tokens (adjust based on your decimals)
await mintTo(
    connection,
    payer,
    mint,
    payerATA.address,
    mintAuthority,
    mintAmount,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
);

console.log(`✓ Minted ${mintAmount / Math.pow(10, decimals)} tokens to:`, payerATA.address.toBase58());

// Get final token balance
const tokenBalance = (await getAccount(
    connection,
    payerATA.address,
    'confirmed',
    TOKEN_2022_PROGRAM_ID
)).amount;

console.log(`Final token balance: ${Number(tokenBalance) / Math.pow(10, decimals)}`);
