r.listen(PORT, () => {
  console.log("server is running on PORT:" + PORT);
  connectDB();
});
