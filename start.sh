#!/bin/bash
cd server && bun run start &
cd client && bun run dev &
wait
