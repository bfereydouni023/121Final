# Golf Bowling (Working Title)

## Project Introduction

### Introducing the team

Tools Lead: Ben Fereydouni

Engine Lead: Cole Falxa-Sturken

Design Lead: Jason Cho

Testing Lead: Jason Cho

### Tools and materials

We plan to build the game using Three.js as our 3D rendering framework and Rapier as our 3D physics engine. Both are available as Node packages, which will make bundling them into our build trivial. Our target platform is the web as we believe it will give the game the greatest reach and ease of access; however, we can also build the game as a standalone executable using Tauri, or another such tool.

As we are building for the web, we will be using TypeScript because of its strong typing capabilities and flexibility. We intend on keeping any textual data within TypeScript data files, as it allows us to maintain strong typing and easily implement a data-oriented design where we can locally define behavior and data. VSCode lends itself to web development, so we intend for the team to use it as our IDE. It also benefits from a massive extension development community that we can take advantage of for LSPs and linting tools. This will prove useful for any curveballs that require use to create custom tooling. For our visual effects, we plan to use NodeToy.co or Polygon.js as both give us Three.js compatible shaders and node-based material editors. Blender is the obvious choice for creating our 3D models, as one of our team members has significant experience with it. We lack experience with audio effects and music, so we will likely try to find open source assets.

We intend to utilize generative AI within our project solely for accessing documentation and generating code snippet. We do not intend to use agentic coding practices.

### Outlook

Our team is hoping to achieve a puzzle experience that offers a level of physicality and precision that other puzzle games do not. By incorporating elements of mini-golf and tile placing puzzle games, we want players to enjoy both the decision making of placing useful tiles and the uncertainty of hitting whether or not they can hit the right shot.

The most difficult part of the project is expected to be creating the various types of tiles for the player to utilize. Some tiles can apply spin to the ball, letting the ball curve around obstacles, and other tiles can bounce the ball upwards over short walls. We expect to be fine tuning and calibrating for a period of time and learning how to utilize our physics engine.

By using libraries and web dev tools, we hope to create a light weight experience in which we truly understand every part that is under the hood. We will be learning how to use 3D graphics libraries and how to integrate them into level design tools. Additionally, we will be learning how to put every library together as one individual package and making the player experience as smooth as possible.

## Dev Log 1

### How we satisfied the software requirements

-Engine Requirements

Our game is built on a custom-made engine that uses three.js for 3D rendering and Rapier for physics simulations. Cole has written up a component system that is very familiar to any designer who has developed on Unity, streamlining the level design experience.

-Tool Requirements

For our development workflow, we have set up linting tools like eslint as well as installing Prettier for automated code formatting. Ben has set up these tools in proper fashion as well as including post push automation in the form of Github Pages.

-Gameplay Requirements

Our game is a mini-golf inspired puzzle game. This utilizes Rapier's physics simulations since our ball rolls around and interacts with obstacles on our level. For the puzzle aspect of the game, we plan on having the player place specific tiles (e.g, trampoline tile) to help them beat an otherwise unbeatable level. The player can exert control over the simulation by hitting the ball toward the goal. Jason has set up lots of components and prefabs like goalposts, walls, and ramps to facilitate in level design.

### Reflection

Our team's plan has indeed changed since team formation. For one, we decided to cut a few features that we initially wanted in the game. Initially, the control scheme was going to be much more nuanced, but we ended up giving it up for a simpler one in the interest of time.

Another consideration is that we initially stuck to our respective roles, but as things started getting set up, we started working in each others roles more often as a team since each member was beginning to get a lot more involved in the overall design process.
