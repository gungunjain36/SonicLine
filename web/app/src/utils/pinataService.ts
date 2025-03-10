// Utility for uploading files to IPFS using Pinata
import { PinataSDK } from "pinata-web3";

// Initialize Pinata SDK with JWT and gateway URL
const pinata = new PinataSDK({
  pinataJwt: `${import.meta.env.VITE_PINATA_JWT}`,
  pinataGateway: `${import.meta.env.VITE_PINATA_GATEWAY}`
});

/**
 * Upload an image to IPFS using Pinata
 * @param {string} imageUrl - URL of the image to upload
 * @param {string} name - Name for the image file
 * @returns {Promise<string>} - IPFS hash (CID) of the uploaded image
 */
export async function uploadImageToIPFS(imageUrl: string, name: string): Promise<string> {
  try {
    console.log(`📤 Uploading image to IPFS: ${name}`);
    
    // First, fetch the image as a blob
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    
    // Create a File object from the blob
    const file = new File([imageBlob], `${name}.png`, { type: 'image/png' });
    
    // Upload the file using Pinata SDK
    const startTime = Date.now();
    const upload = await pinata.upload.file(file);
    const uploadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Image uploaded to IPFS in ${uploadTime}s with CID: ${upload.IpfsHash}`);
    
    return upload.IpfsHash;
  } catch (error) {
    console.error('❌ Error uploading image to IPFS:', error);
    throw error;
  }
}

/**
 * Create and upload NFT metadata to IPFS
 * @param {string} name - Name of the NFT
 * @param {string} description - Description of the NFT
 * @param {string} imageCid - IPFS CID of the image
 * @returns {Promise<string>} - IPFS hash (CID) of the metadata
 */
export async function uploadMetadataToIPFS(name: string, description: string, imageCid: string): Promise<string> {
  try {
    console.log(`📝 Creating and uploading metadata for: ${name}`);
    
    // Create metadata object
    const metadata = {
      name,
      description,
      image: `ipfs://${imageCid}`,
      attributes: [
        {
          trait_type: 'Generator',
          value: 'fal.ai Ideogram'
        },
        {
          trait_type: 'Created with',
          value: 'SonicLine'
        }
      ]
    };
    
    // Convert metadata to JSON string
    const metadataString = JSON.stringify(metadata);
    
    // Create a Blob from the JSON string
    const metadataBlob = new Blob([metadataString], { type: 'application/json' });
    
    // Create a File object from the blob
    const file = new File([metadataBlob], `${name.replace(/[^a-zA-Z0-9]/g, '_')}_metadata.json`, { type: 'application/json' });
    
    // Upload the file using Pinata SDK
    const startTime = Date.now();
    const upload = await pinata.upload.file(file);
    const uploadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Metadata uploaded to IPFS in ${uploadTime}s with CID: ${upload.IpfsHash}`);
    
    return upload.IpfsHash;
  } catch (error) {
    console.error('❌ Error uploading metadata to IPFS:', error);
    throw error;
  }
}

/**
 * Get a gateway URL for an IPFS hash
 * @param {string} cid - IPFS hash (CID)
 * @returns {Promise<string>} - Gateway URL for the IPFS hash
 */
export async function getIpfsGatewayUrl(cid: string): Promise<string> {
  try {
    const gatewayUrl = await pinata.gateways.convert(cid);
    return gatewayUrl;
  } catch (error) {
    console.error('❌ Error getting gateway URL:', error);
    throw error;
  }
} 