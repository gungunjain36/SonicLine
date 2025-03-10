// Service for generating and minting NFTs
import { generateImage } from './falAiService';
import { uploadImageToIPFS, uploadMetadataToIPFS, getIpfsGatewayUrl } from './pinataService';
import axios from 'axios';

interface NftGenerationResult {
  success: boolean;
  imageUrl?: string;
  imageCid?: string;
  metadataCid?: string;
  metadataUri?: string;
  metadataUrl?: string;
  transactionHash?: string;
  explorerLink?: string;
  error?: string;
  timings?: {
    imageGeneration: string;
    ipfsImageUpload: string;
    ipfsMetadataUpload?: string;
    minting?: string;
    total: string;
  };
}

/**
 * Generate an NFT from a text description
 * @param {string} description - Text description of the image to generate
 * @returns {Promise<NftGenerationResult>} - Object containing transaction details
 */
export async function generateAndMintNFT(description: string): Promise<NftGenerationResult> {
  try {
    // Step 1: Generate the image using fal.ai
    console.log('🖼️ Generating image from description:', description);
    const startTime = Date.now();
    const imageUrl = await generateImage(description);
    const imageGenTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Image generated in ${imageGenTime}s:`, imageUrl);
    
    // Step 2: Upload the image to IPFS
    console.log('📤 Uploading image to IPFS...');
    const sanitizedDescription = description.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const ipfsStartTime = Date.now();
    const imageCid = await uploadImageToIPFS(imageUrl, sanitizedDescription);
    const ipfsUploadTime = ((Date.now() - ipfsStartTime) / 1000).toFixed(2);
    console.log(`✅ Image uploaded to IPFS in ${ipfsUploadTime}s with CID:`, imageCid);
    
    // Get gateway URL for the image
    const imageGatewayUrl = await getIpfsGatewayUrl(imageCid);
    console.log(`🔗 Image gateway URL:`, imageGatewayUrl);
    
    // Step 3: Create and upload metadata to IPFS
    console.log('📝 Creating and uploading metadata...');
    const metadataStartTime = Date.now();
    const metadataCid = await uploadMetadataToIPFS(
      `NFT: ${description.substring(0, 30)}...`,
      description,
      imageCid
    );
    const metadataUploadTime = ((Date.now() - metadataStartTime) / 1000).toFixed(2);
    console.log(`✅ Metadata uploaded to IPFS in ${metadataUploadTime}s with CID:`, metadataCid);
    
    // Get gateway URL for the metadata
    const metadataGatewayUrl = await getIpfsGatewayUrl(metadataCid);
    console.log(`🔗 Metadata gateway URL:`, metadataGatewayUrl);
    
    // Step 4: Mint the NFT using the backend API
    console.log('⛓️ Minting NFT on Sonic blockchain...');
    const metadataUri = `ipfs://${metadataCid}`;
    
    const mintStartTime = Date.now();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const response = await axios.post(`${apiUrl}/api/mint-nft`, {
      uri: metadataUri,
      description
    });
    const mintTime = ((Date.now() - mintStartTime) / 1000).toFixed(2);
    
    console.log(`🎉 NFT minted successfully in ${mintTime}s:`, response.data);
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Total NFT generation and minting process took ${totalTime}s`);
    
    return {
      success: true,
      imageUrl: imageGatewayUrl || imageUrl,
      imageCid,
      metadataCid,
      metadataUri,
      metadataUrl: metadataGatewayUrl,
      transactionHash: response.data.transaction_hash,
      explorerLink: response.data.explorer_link,
      timings: {
        imageGeneration: imageGenTime,
        ipfsImageUpload: ipfsUploadTime,
        ipfsMetadataUpload: metadataUploadTime,
        minting: mintTime,
        total: totalTime
      }
    };
  } catch (error) {
    console.error('❌ Error generating and minting NFT:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Generate an NFT from a text description with progress updates
 * @param {string} description - Text description of the image to generate
 * @param {Function} updateProgress - Callback function to update progress
 * @returns {Promise<NftGenerationResult>} - Object containing the image URL and other details
 */
export async function generateNFT(description: string, updateProgress: (message: string) => void): Promise<NftGenerationResult> {
  try {
    // Update progress with initial message
    updateProgress('Starting to generate your NFT image...');
    
    // Step 1: Generate the image using fal.ai
    console.log('🖼️ Generating image from description:', description);
    const startTime = Date.now();
    const imageUrl = await generateImage(description);
    const imageGenTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Image generated in ${imageGenTime}s:`, imageUrl);
    
    // Update progress after image generation
    updateProgress(`Image generated successfully in ${imageGenTime} seconds!`);
    
    // Step 2: Upload the image to IPFS
    updateProgress('Uploading image to decentralized storage...');
    console.log('📤 Uploading image to IPFS...');
    const sanitizedDescription = description.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const ipfsStartTime = Date.now();
    const imageCid = await uploadImageToIPFS(imageUrl, sanitizedDescription);
    const ipfsUploadTime = ((Date.now() - ipfsStartTime) / 1000).toFixed(2);
    console.log(`✅ Image uploaded to IPFS in ${ipfsUploadTime}s with CID:`, imageCid);
    
    // Update progress after IPFS upload
    updateProgress('Image stored securely on decentralized network!');
    
    // Get gateway URL for the image
    const imageGatewayUrl = await getIpfsGatewayUrl(imageCid);
    console.log(`🔗 Image gateway URL:`, imageGatewayUrl);
    
    // Return the result with the image URL
    return {
      success: true,
      imageUrl: imageGatewayUrl || imageUrl,
      imageCid,
      timings: {
        imageGeneration: imageGenTime,
        ipfsImageUpload: ipfsUploadTime,
        total: ((Date.now() - startTime) / 1000).toFixed(2)
      }
    };
  } catch (error) {
    console.error('❌ Error generating NFT:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error occurred during NFT generation');
  }
} 