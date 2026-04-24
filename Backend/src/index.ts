import "dotenv/config";
import app from "./server";

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});