Ref = NMS_MOD_DEFINITION_CONTAINER.MODIFICATIONS[1].MBIN_CHANGE_TABLE

table.insert(Ref, 1, {
  MBIN_FILE_SOURCE = "METADATA/REALITY/TABLES/NMS_DIALOG_GCALIENPUZZLETABLE.MBIN",
  EXML_CHANGE_TABLE = {
    {
      -- remove existing judgement dialog as we will provide our own
      SPECIAL_KEY_WORDS = {"Id", "EXOTIC_CHEF"},
      REMOVE = "SECTION",
      REPLACE_TYPE = "ALL"
    },
  }
})