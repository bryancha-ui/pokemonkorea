import torch
import numpy as np
from shap_e.diffusion.sample import sample_latents
from shap_e.diffusion.gaussian_diffusion import diffusion_from_config
from shap_e.models.download import load_model, load_config
from shap_e.util.notebooks import create_pan_cameras, decode_latent_images
from shap_e.util.image_util import load_image
from PIL import Image
import io
import imageio
import os

# Set device
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

# Load models
print("Loading models...")
xm = load_model('transmitter', device=device)
model = load_model('image300M', device=device)
diffusion = diffusion_from_config(load_config('diffusion'))

# Parameters
batch_size = 4
guidance_scale = 3.0

# Load the 2D image
image_path = "/Users/hyungjucha/Documents/PokemonKorea/phaser-game/public/assets/disguijar.png"
print(f"Loading image from: {image_path}")
image = load_image(image_path)

# Generate 3D latents
print("Generating 3D latents...")
latents = sample_latents(
    batch_size=batch_size,
    model=model,
    diffusion=diffusion,
    guidance_scale=guidance_scale,
    model_kwargs=dict(images=[image] * batch_size),
    progress=True,
    clip_denoised=True,
    use_fp16=True,
    use_karras=True,
    karras_steps=64,
    sigma_min=1e-3,
    sigma_max=160,
    s_churn=0,
)

# Render the 3D model
render_mode = 'nerf'  # you can change this to 'stf' for mesh rendering
size = 64  # this is the size of the renders; higher values take longer to render.

print(f"Rendering 3D model with {render_mode} mode...")
cameras = create_pan_cameras(size, device)

for i, latent in enumerate(latents):
    print(f"Rendering latent {i+1}/{len(latents)}")
    images = decode_latent_images(xm, latent, cameras, rendering_mode=render_mode)
    
    # Convert images to PIL format and save as GIF
    pil_images = []
    for image_tensor in images:
        # Convert from tensor to PIL Image
        image_np = image_tensor.cpu().numpy()
        if image_np.max() <= 1.0:
            image_np = (image_np * 255).astype('uint8')
        else:
            image_np = image_np.astype('uint8')
        
        # Handle different shapes
        if len(image_np.shape) == 3:
            # (H, W, C) format
            if image_np.shape[2] == 3:
                pil_img = Image.fromarray(image_np, 'RGB')
            else:
                pil_img = Image.fromarray(image_np.squeeze(), 'L')
        else:
            pil_img = Image.fromarray(image_np.squeeze(), 'L')
        
        pil_images.append(pil_img)
    
    # Save the GIF
    gif_filename = f"/Users/hyungjucha/Documents/PokemonKorea/disguijar_3d_{i}.gif"
    print(f"Saving GIF to: {gif_filename}")
    
    # Save using imageio
    imageio.mimsave(gif_filename, [np.array(img) for img in pil_images], duration=0.1, loop=0)
    
    # Also save individual frames
    output_dir = f"/Users/hyungjucha/Documents/PokemonKorea/disguijar_3d_frames_{i}"
    os.makedirs(output_dir, exist_ok=True)
    
    for frame_idx, pil_img in enumerate(pil_images):
        frame_path = os.path.join(output_dir, f"frame_{frame_idx:03d}.png")
        pil_img.save(frame_path)
    
    print(f"Saved {len(pil_images)} frames to {output_dir}")
    
print("3D generation complete!")
